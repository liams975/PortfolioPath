"""Payment API endpoints using Stripe."""
import stripe
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.api.auth import get_current_active_user
from app.models.user import User
from app.database import get_db

router = APIRouter(prefix="/api/payments", tags=["Payments"])

# Configure Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY if hasattr(settings, 'STRIPE_SECRET_KEY') else None


# ============ Request/Response Models ============

class CreateCheckoutRequest(BaseModel):
    """Request to create a checkout session."""
    price_id: str  # Stripe Price ID for the product


class CheckoutResponse(BaseModel):
    """Response with checkout session URL."""
    checkout_url: str
    session_id: str


class PaymentStatusResponse(BaseModel):
    """Response with payment status."""
    is_premium: bool
    payment_status: Optional[str] = None
    expires_at: Optional[str] = None


# ============ Endpoints ============

@router.get("/config")
async def get_payment_config():
    """
    Get public Stripe configuration.
    Returns the publishable key for client-side Stripe initialization.
    """
    publishable_key = settings.STRIPE_PUBLISHABLE_KEY if hasattr(settings, 'STRIPE_PUBLISHABLE_KEY') else None
    
    if not publishable_key:
        raise HTTPException(
            status_code=503,
            detail="Payment system not configured"
        )
    
    return {
        "publishable_key": publishable_key,
        "products": [
            {
                "id": "premium_lifetime",
                "name": "PortfolioPath Pro - Lifetime",
                "description": "One-time payment for lifetime access to all premium features",
                "price": 29.99,
                "price_id": settings.STRIPE_PRICE_ID if hasattr(settings, 'STRIPE_PRICE_ID') else None,
                "features": [
                    "Unlimited simulations",
                    "Advanced Monte Carlo models",
                    "Portfolio comparison",
                    "Export to PDF/CSV",
                    "Priority support",
                    "All future updates"
                ]
            }
        ]
    }


@router.post("/create-checkout-session", response_model=CheckoutResponse)
async def create_checkout_session(
    request: CreateCheckoutRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a Stripe checkout session for one-time payment.
    
    - **price_id**: The Stripe Price ID for the product
    """
    if not stripe.api_key:
        raise HTTPException(
            status_code=503,
            detail="Payment system not configured"
        )
    
    try:
        # Create checkout session
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[
                {
                    'price': request.price_id,
                    'quantity': 1,
                }
            ],
            mode='payment',  # One-time payment, not subscription
            success_url=settings.FRONTEND_URL + '/payment/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=settings.FRONTEND_URL + '/payment/cancel',
            customer_email=current_user.email,
            metadata={
                'user_id': str(current_user.id),
                'product': 'premium_lifetime'
            },
            # Prevent duplicate payments
            client_reference_id=str(current_user.id),
        )
        
        return CheckoutResponse(
            checkout_url=checkout_session.url,
            session_id=checkout_session.id
        )
        
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Payment error: {str(e)}"
        )


@router.get("/status", response_model=PaymentStatusResponse)
async def get_payment_status(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get the current user's payment/premium status.
    """
    return PaymentStatusResponse(
        is_premium=current_user.is_premium if hasattr(current_user, 'is_premium') else False,
        payment_status=current_user.payment_status if hasattr(current_user, 'payment_status') else None,
        expires_at=None  # Lifetime access doesn't expire
    )


@router.post("/webhook")
async def stripe_webhook(request_body: dict, db: AsyncSession = Depends(get_db)):
    """
    Handle Stripe webhook events.
    
    This endpoint receives events from Stripe when payment status changes.
    """
    # In production, verify the webhook signature
    # sig_header = request.headers.get('stripe-signature')
    # endpoint_secret = settings.STRIPE_WEBHOOK_SECRET
    
    event_type = request_body.get('type', '')
    data = request_body.get('data', {}).get('object', {})
    
    if event_type == 'checkout.session.completed':
        # Payment was successful
        user_id = data.get('metadata', {}).get('user_id')
        if user_id:
            # Update user's premium status in database
            result = await db.execute(select(User).filter(User.id == int(user_id)))
            user = result.scalar_one_or_none()
            if user:
                user.is_premium = True
                user.payment_status = 'completed'
                user.stripe_customer_id = data.get('customer')
                await db.commit()
                
        return {"status": "success", "message": "Payment processed"}
    
    elif event_type == 'payment_intent.payment_failed':
        # Payment failed
        user_id = data.get('metadata', {}).get('user_id')
        if user_id:
            result = await db.execute(select(User).filter(User.id == int(user_id)))
            user = result.scalar_one_or_none()
            if user:
                user.payment_status = 'failed'
                await db.commit()
                
        return {"status": "success", "message": "Payment failure recorded"}
    
    return {"status": "success", "message": f"Unhandled event type: {event_type}"}


@router.post("/verify-session")
async def verify_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Verify a checkout session and update user's premium status.
    Called by frontend after successful payment redirect.
    """
    if not stripe.api_key:
        raise HTTPException(
            status_code=503,
            detail="Payment system not configured"
        )
    
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        if session.payment_status == 'paid':
            # Update user's premium status
            current_user.is_premium = True
            current_user.payment_status = 'completed'
            current_user.stripe_customer_id = session.customer
            await db.commit()
            
            return {
                "status": "success",
                "is_premium": True,
                "message": "Payment verified successfully!"
            }
        else:
            return {
                "status": "pending",
                "is_premium": False,
                "message": "Payment is still processing"
            }
            
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not verify payment: {str(e)}"
        )
