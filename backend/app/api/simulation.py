"""Monte Carlo simulation API endpoints."""
import math
from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.services.monte_carlo import MonteCarloEngine, SimulationConfig
from app.services.stock_service import StockService
from app.database import get_db
from app.services.auth_service import get_current_user
from app.models.user import User
from app.models.simulation_usage import SimulationUsage

router = APIRouter(prefix="/api/simulation", tags=["Simulation"])
security = HTTPBearer(auto_error=False)

# Free tier limits
FREE_DAILY_SIMULATION_LIMIT = 10


# ============ Request Models ============

class HoldingInput(BaseModel):
    """Portfolio holding input."""
    ticker: str
    allocation: float = Field(..., ge=0, le=100)


class SimulationRequest(BaseModel):
    """Request model for running a simulation."""
    holdings: List[HoldingInput]
    initial_investment: float = Field(default=10000, ge=0)
    monthly_contribution: float = Field(default=0, ge=0)
    time_horizon: int = Field(default=10, ge=1, le=50)
    num_simulations: int = Field(default=1000, ge=100, le=10000)
    include_dividends: bool = True
    dividend_yield: Optional[float] = None
    include_jump_diffusion: bool = False
    jump_probability: float = Field(default=0.05, ge=0, le=1)
    jump_mean: float = Field(default=-0.1)
    jump_std: float = Field(default=0.15, ge=0)


class ComparisonRequest(BaseModel):
    """Request for comparing two portfolios."""
    portfolio_a: SimulationRequest
    portfolio_b: SimulationRequest


class UsageResponse(BaseModel):
    """Response for usage status."""
    daily_simulations: int
    daily_limit: int
    remaining: int
    is_premium: bool
    reset_at: str  # UTC date string


# ============ Helper Functions ============

async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Get user if authenticated, None otherwise."""
    if credentials is None:
        return None
    try:
        user = await get_current_user(db, credentials.credentials)
        return user
    except:
        return None


async def check_and_update_usage(
    db: AsyncSession,
    user: Optional[User]
) -> tuple[bool, int, int]:
    """
    Check if user can run simulation and update usage.
    Returns: (can_run, current_count, limit)
    """
    if user is None:
        # Anonymous users always blocked - must sign up
        return False, 0, 0
    
    # Premium users have unlimited
    if user.is_premium:
        return True, 0, -1  # -1 means unlimited
    
    today = date.today()
    
    # Find or create usage record for today
    stmt = select(SimulationUsage).where(
        SimulationUsage.user_id == user.id,
        SimulationUsage.usage_date == today
    )
    result = await db.execute(stmt)
    usage = result.scalar_one_or_none()
    
    if usage is None:
        # Create new record for today
        usage = SimulationUsage(
            user_id=user.id,
            usage_date=today,
            simulation_count=0
        )
        db.add(usage)
    
    # Check limit
    if usage.simulation_count >= FREE_DAILY_SIMULATION_LIMIT:
        return False, usage.simulation_count, FREE_DAILY_SIMULATION_LIMIT
    
    # Increment and save
    usage.simulation_count += 1
    usage.last_simulation_at = datetime.utcnow()
    await db.commit()
    
    return True, usage.simulation_count, FREE_DAILY_SIMULATION_LIMIT


# ============ Endpoints ============

@router.get("/usage")
async def get_usage_status(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Get current simulation usage status for authenticated user."""
    user = await get_optional_user(credentials, db)
    
    if user is None:
        return UsageResponse(
            daily_simulations=0,
            daily_limit=FREE_DAILY_SIMULATION_LIMIT,
            remaining=0,
            is_premium=False,
            reset_at=(date.today().isoformat())
        )
    
    if user.is_premium:
        return UsageResponse(
            daily_simulations=0,
            daily_limit=-1,  # Unlimited
            remaining=-1,
            is_premium=True,
            reset_at=""
        )
    
    today = date.today()
    stmt = select(SimulationUsage).where(
        SimulationUsage.user_id == user.id,
        SimulationUsage.usage_date == today
    )
    result = await db.execute(stmt)
    usage = result.scalar_one_or_none()
    
    current_count = usage.simulation_count if usage else 0
    
    return UsageResponse(
        daily_simulations=current_count,
        daily_limit=FREE_DAILY_SIMULATION_LIMIT,
        remaining=max(0, FREE_DAILY_SIMULATION_LIMIT - current_count),
        is_premium=False,
        reset_at=today.isoformat()
    )


@router.post("/run")
async def run_simulation(
    request: SimulationRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """
    Run Monte Carlo simulation for a portfolio.
    
    Requires authentication. Free users limited to 10 simulations/day.
    Returns probability distributions, risk metrics, and sample paths.
    """
    # Get user (required for simulation)
    user = await get_optional_user(credentials, db)
    
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required to run simulations. Please sign up for a free account."
        )
    
    # Check usage limits
    can_run, current_count, limit = await check_and_update_usage(db, user)
    
    if not can_run:
        raise HTTPException(
            status_code=429,
            detail=f"Daily simulation limit reached ({limit}/day). Upgrade to Pro for unlimited simulations."
        )
    
    # Validate holdings sum to 100%
    total_allocation = sum(h.allocation for h in request.holdings)
    if abs(total_allocation - 100) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Holdings must sum to 100% (current: {total_allocation}%)"
        )
    
    # Convert time horizon years to trading days for weighted averaging
    # Default to 252 trading days per year
    target_days = request.time_horizon * 252
    
    # Fetch historical data for each holding with weighted statistics
    historical_data = {}
    for holding in request.holdings:
        hist = await StockService.get_historical(
            holding.ticker, 
            period="max",  # Fetch max data for better weighting
            target_days=target_days  # Use time horizon for weighted averaging
        )
        if hist:
            returns = [d['return'] for d in hist['data'] if d['return'] != 0]
            historical_data[holding.ticker] = {
                'returns': returns,
                'statistics': hist['statistics']
            }
    
    if not historical_data:
        raise HTTPException(
            status_code=400,
            detail="Could not fetch historical data for any holdings"
        )
    
    # Calculate portfolio metrics
    holdings_list = [{"ticker": h.ticker, "allocation": h.allocation} for h in request.holdings]
    
    # Use simple weighted average for portfolio metrics
    total_return = 0
    total_vol = 0
    total_div = 0
    
    for holding in request.holdings:
        ticker = holding.ticker
        weight = holding.allocation / 100
        
        if ticker in historical_data:
            stats = historical_data[ticker]['statistics']
            total_return += stats['mean_return'] * weight
            total_vol += stats['volatility'] * weight  # Simplified, ignores correlation
    
    # Get dividend yield if not specified
    # Note: yfinance returns dividendYield as a percentage (e.g., 1.5 for 1.5%)
    # We need to convert it to decimal (e.g., 0.015)
    if request.dividend_yield is None:
        for holding in request.holdings:
            quote = await StockService.get_quote(holding.ticker)
            if quote and quote.get('dividendYield'):
                # Convert from percentage to decimal (divide by 100)
                div_yield = (quote['dividendYield'] or 0) / 100
                total_div += div_yield * (holding.allocation / 100)
    else:
        total_div = request.dividend_yield
    
    # Create simulation config
    config = SimulationConfig(
        initial_investment=request.initial_investment,
        monthly_contribution=request.monthly_contribution,
        time_horizon=request.time_horizon,
        num_simulations=request.num_simulations,
        include_dividends=request.include_dividends,
        dividend_yield=total_div,
        include_jump_diffusion=request.include_jump_diffusion,
        jump_probability=request.jump_probability,
        jump_mean=request.jump_mean,
        jump_std=request.jump_std
    )
    
    # Run simulation
    results = await MonteCarloEngine.run_simulation(
        expected_return=total_return,
        volatility=total_vol,
        config=config
    )
    
    # Add holding details to results
    results["holdings"] = [
        {
            "ticker": h.ticker,
            "allocation": h.allocation,
            "statistics": historical_data.get(h.ticker, {}).get('statistics', {})
        }
        for h in request.holdings
    ]
    
    return results


@router.post("/compare")
async def compare_portfolios(request: ComparisonRequest):
    """
    Compare two portfolios side by side.
    
    Returns simulation results for both portfolios.
    """
    # Run both simulations
    results_a = await run_simulation(request.portfolio_a)
    results_b = await run_simulation(request.portfolio_b)
    
    return {
        "portfolio_a": results_a,
        "portfolio_b": results_b,
        "comparison": {
            "return_difference": results_a["final_values"]["mean"] - results_b["final_values"]["mean"],
            "risk_difference": results_a["risk_metrics"]["max_drawdown_mean"] - results_b["risk_metrics"]["max_drawdown_mean"],
            "sharpe_difference": results_a["risk_metrics"]["sharpe_ratio"] - results_b["risk_metrics"]["sharpe_ratio"],
            "profit_probability_difference": results_a["risk_metrics"]["probability_profit"] - results_b["risk_metrics"]["probability_profit"]
        }
    }


@router.post("/efficient-frontier")
async def generate_efficient_frontier(
    tickers: List[str],
    num_portfolios: int = 100
):
    """
    Generate efficient frontier for a set of assets.
    
    - **tickers**: List of ticker symbols to include
    - **num_portfolios**: Number of random portfolios to generate
    """
    if len(tickers) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 tickers")
    
    if len(tickers) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 tickers")
    
    # Fetch historical returns for each ticker
    returns_data = {}
    for ticker in tickers:
        hist = await StockService.get_historical(ticker.upper(), period="5y")
        if hist:
            returns = [d['return'] for d in hist['data'] if d['return'] != 0]
            returns_data[ticker.upper()] = returns
    
    if len(returns_data) < 2:
        raise HTTPException(
            status_code=400,
            detail="Could not fetch data for enough tickers"
        )
    
    # Generate efficient frontier
    result = await MonteCarloEngine.generate_efficient_frontier(
        list(returns_data.keys()),
        returns_data,
        num_portfolios
    )
    
    return result


@router.post("/goal-probability")
async def calculate_goal_probability(
    request: SimulationRequest,
    target_amount: float = 100000
):
    """
    Calculate probability of reaching a financial goal.
    
    - **target_amount**: Target portfolio value to reach
    """
    # Run simulation
    results = await run_simulation(request)
    
    # Calculate goal probability from final values
    final_values = results["final_values"]
    mean = final_values["mean"]
    std = final_values["std"]
    
    if std > 0:
        z_score = (target_amount - mean) / std
        probability = 1 - 0.5 * (1 + math.erf(z_score / math.sqrt(2)))
    else:
        probability = 1.0 if mean >= target_amount else 0.0
    
    return {
        "target_amount": target_amount,
        "probability": float(probability),
        "expected_final_value": mean,
        "percentile_outcomes": final_values["percentiles"],
        "time_horizon": request.time_horizon
    }
