"""Portfolio API endpoints for CRUD operations."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.api.auth import get_current_active_user
from app.models.user import User
from app.models.portfolio import Portfolio, PortfolioHolding

router = APIRouter(prefix="/api/portfolios", tags=["Portfolios"])


# ============ Request/Response Models ============

class HoldingCreate(BaseModel):
    """Request model for creating a holding."""
    ticker: str = Field(..., max_length=10)
    name: Optional[str] = None
    allocation: float = Field(..., ge=0, le=100)


class HoldingResponse(BaseModel):
    """Response model for a holding."""
    id: int
    ticker: str
    name: Optional[str]
    allocation: float
    
    class Config:
        from_attributes = True


class PortfolioCreate(BaseModel):
    """Request model for creating a portfolio."""
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    initial_investment: float = Field(default=10000, ge=0)
    monthly_contribution: float = Field(default=0, ge=0)
    time_horizon: int = Field(default=10, ge=1, le=50)
    holdings: List[HoldingCreate] = []
    simulation_config: Optional[dict] = None


class PortfolioUpdate(BaseModel):
    """Request model for updating a portfolio."""
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    initial_investment: Optional[float] = Field(None, ge=0)
    monthly_contribution: Optional[float] = Field(None, ge=0)
    time_horizon: Optional[int] = Field(None, ge=1, le=50)
    holdings: Optional[List[HoldingCreate]] = None
    simulation_config: Optional[dict] = None


class PortfolioResponse(BaseModel):
    """Response model for a portfolio."""
    id: int
    name: str
    description: Optional[str]
    initial_investment: float
    monthly_contribution: float
    time_horizon: int
    simulation_config: Optional[dict]
    holdings: List[HoldingResponse]
    total_allocation: float
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class PortfolioListResponse(BaseModel):
    """Response model for listing portfolios."""
    id: int
    name: str
    description: Optional[str]
    holdings_count: int
    total_allocation: float
    created_at: str
    
    class Config:
        from_attributes = True


# ============ Helper Functions ============

async def get_portfolio_or_404(
    db: AsyncSession, 
    portfolio_id: int, 
    user_id: int
) -> Portfolio:
    """Get a portfolio by ID or raise 404."""
    result = await db.execute(
        select(Portfolio)
        .options(selectinload(Portfolio.holdings))
        .where(Portfolio.id == portfolio_id, Portfolio.owner_id == user_id)
    )
    portfolio = result.scalar_one_or_none()
    
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )
    
    return portfolio


# ============ Endpoints ============

@router.get("", response_model=List[PortfolioListResponse])
async def list_portfolios(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all portfolios for the current user.
    """
    result = await db.execute(
        select(Portfolio)
        .options(selectinload(Portfolio.holdings))
        .where(Portfolio.owner_id == current_user.id)
        .order_by(Portfolio.updated_at.desc())
    )
    portfolios = result.scalars().all()
    
    return [
        PortfolioListResponse(
            id=p.id,
            name=p.name,
            description=p.description,
            holdings_count=len(p.holdings),
            total_allocation=sum(h.allocation for h in p.holdings),
            created_at=p.created_at.isoformat() if p.created_at else ""
        )
        for p in portfolios
    ]


@router.post("", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED)
async def create_portfolio(
    request: PortfolioCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new portfolio.
    
    - Holdings allocations should sum to 100%
    """
    # Validate total allocation
    total_allocation = sum(h.allocation for h in request.holdings)
    if request.holdings and abs(total_allocation - 100) > 0.01:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Holdings must sum to 100% (current: {total_allocation}%)"
        )
    
    # Create portfolio
    portfolio = Portfolio(
        name=request.name,
        description=request.description,
        owner_id=current_user.id,
        initial_investment=request.initial_investment,
        monthly_contribution=request.monthly_contribution,
        time_horizon=request.time_horizon,
        simulation_config=request.simulation_config or {}
    )
    db.add(portfolio)
    await db.flush()  # Get portfolio ID
    
    # Create holdings
    for holding_data in request.holdings:
        holding = PortfolioHolding(
            portfolio_id=portfolio.id,
            ticker=holding_data.ticker.upper(),
            name=holding_data.name,
            allocation=holding_data.allocation
        )
        db.add(holding)
    
    await db.commit()
    await db.refresh(portfolio)
    
    # Reload with holdings
    portfolio = await get_portfolio_or_404(db, portfolio.id, current_user.id)
    
    return PortfolioResponse(
        id=portfolio.id,
        name=portfolio.name,
        description=portfolio.description,
        initial_investment=portfolio.initial_investment,
        monthly_contribution=portfolio.monthly_contribution,
        time_horizon=portfolio.time_horizon,
        simulation_config=portfolio.simulation_config,
        holdings=[HoldingResponse.model_validate(h) for h in portfolio.holdings],
        total_allocation=sum(h.allocation for h in portfolio.holdings),
        created_at=portfolio.created_at.isoformat() if portfolio.created_at else "",
        updated_at=portfolio.updated_at.isoformat() if portfolio.updated_at else ""
    )


@router.get("/{portfolio_id}", response_model=PortfolioResponse)
async def get_portfolio(
    portfolio_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific portfolio by ID.
    """
    portfolio = await get_portfolio_or_404(db, portfolio_id, current_user.id)
    
    return PortfolioResponse(
        id=portfolio.id,
        name=portfolio.name,
        description=portfolio.description,
        initial_investment=portfolio.initial_investment,
        monthly_contribution=portfolio.monthly_contribution,
        time_horizon=portfolio.time_horizon,
        simulation_config=portfolio.simulation_config,
        holdings=[HoldingResponse.model_validate(h) for h in portfolio.holdings],
        total_allocation=sum(h.allocation for h in portfolio.holdings),
        created_at=portfolio.created_at.isoformat() if portfolio.created_at else "",
        updated_at=portfolio.updated_at.isoformat() if portfolio.updated_at else ""
    )


@router.put("/{portfolio_id}", response_model=PortfolioResponse)
async def update_portfolio(
    portfolio_id: int,
    request: PortfolioUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a portfolio.
    
    Only provided fields will be updated.
    If holdings are provided, they will replace existing holdings.
    """
    portfolio = await get_portfolio_or_404(db, portfolio_id, current_user.id)
    
    # Update fields if provided
    if request.name is not None:
        portfolio.name = request.name
    if request.description is not None:
        portfolio.description = request.description
    if request.initial_investment is not None:
        portfolio.initial_investment = request.initial_investment
    if request.monthly_contribution is not None:
        portfolio.monthly_contribution = request.monthly_contribution
    if request.time_horizon is not None:
        portfolio.time_horizon = request.time_horizon
    if request.simulation_config is not None:
        portfolio.simulation_config = request.simulation_config
    
    # Update holdings if provided
    if request.holdings is not None:
        # Validate total allocation
        total_allocation = sum(h.allocation for h in request.holdings)
        if request.holdings and abs(total_allocation - 100) > 0.01:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Holdings must sum to 100% (current: {total_allocation}%)"
            )
        
        # Delete existing holdings
        for holding in portfolio.holdings:
            await db.delete(holding)
        await db.flush()  # Ensure deletions are processed before adding new ones
        
        # Create new holdings
        for holding_data in request.holdings:
            holding = PortfolioHolding(
                portfolio_id=portfolio.id,
                ticker=holding_data.ticker.upper(),
                name=holding_data.name,
                allocation=holding_data.allocation
            )
            db.add(holding)
    
    await db.commit()
    
    # Reload portfolio
    portfolio = await get_portfolio_or_404(db, portfolio_id, current_user.id)
    
    return PortfolioResponse(
        id=portfolio.id,
        name=portfolio.name,
        description=portfolio.description,
        initial_investment=portfolio.initial_investment,
        monthly_contribution=portfolio.monthly_contribution,
        time_horizon=portfolio.time_horizon,
        simulation_config=portfolio.simulation_config,
        holdings=[HoldingResponse.model_validate(h) for h in portfolio.holdings],
        total_allocation=sum(h.allocation for h in portfolio.holdings),
        created_at=portfolio.created_at.isoformat() if portfolio.created_at else "",
        updated_at=portfolio.updated_at.isoformat() if portfolio.updated_at else ""
    )


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio(
    portfolio_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a portfolio.
    """
    portfolio = await get_portfolio_or_404(db, portfolio_id, current_user.id)
    await db.delete(portfolio)
    await db.commit()


@router.post("/{portfolio_id}/duplicate", response_model=PortfolioResponse)
async def duplicate_portfolio(
    portfolio_id: int,
    new_name: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Duplicate a portfolio with all its holdings.
    """
    original = await get_portfolio_or_404(db, portfolio_id, current_user.id)
    
    # Create new portfolio
    new_portfolio = Portfolio(
        name=new_name or f"{original.name} (Copy)",
        description=original.description,
        owner_id=current_user.id,
        initial_investment=original.initial_investment,
        monthly_contribution=original.monthly_contribution,
        time_horizon=original.time_horizon,
        simulation_config=original.simulation_config
    )
    db.add(new_portfolio)
    await db.flush()
    
    # Copy holdings
    for holding in original.holdings:
        new_holding = PortfolioHolding(
            portfolio_id=new_portfolio.id,
            ticker=holding.ticker,
            name=holding.name,
            allocation=holding.allocation
        )
        db.add(new_holding)
    
    await db.commit()
    
    # Reload portfolio
    new_portfolio = await get_portfolio_or_404(db, new_portfolio.id, current_user.id)
    
    return PortfolioResponse(
        id=new_portfolio.id,
        name=new_portfolio.name,
        description=new_portfolio.description,
        initial_investment=new_portfolio.initial_investment,
        monthly_contribution=new_portfolio.monthly_contribution,
        time_horizon=new_portfolio.time_horizon,
        simulation_config=new_portfolio.simulation_config,
        holdings=[HoldingResponse.model_validate(h) for h in new_portfolio.holdings],
        total_allocation=sum(h.allocation for h in new_portfolio.holdings),
        created_at=new_portfolio.created_at.isoformat() if new_portfolio.created_at else "",
        updated_at=new_portfolio.updated_at.isoformat() if new_portfolio.updated_at else ""
    )
