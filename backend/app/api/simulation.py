"""Monte Carlo simulation API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.monte_carlo import MonteCarloEngine, SimulationConfig
from app.services.stock_service import StockService

router = APIRouter(prefix="/api/simulation", tags=["Simulation"])


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


# ============ Endpoints ============

@router.post("/run")
async def run_simulation(request: SimulationRequest):
    """
    Run Monte Carlo simulation for a portfolio.
    
    Returns probability distributions, risk metrics, and sample paths.
    """
    # Validate holdings sum to 100%
    total_allocation = sum(h.allocation for h in request.holdings)
    if abs(total_allocation - 100) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Holdings must sum to 100% (current: {total_allocation}%)"
        )
    
    # Fetch historical data for each holding
    historical_data = {}
    for holding in request.holdings:
        hist = await StockService.get_historical(holding.ticker, period="5y")
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
    if request.dividend_yield is None:
        for holding in request.holdings:
            quote = await StockService.get_quote(holding.ticker)
            if quote and quote.get('dividendYield'):
                total_div += (quote['dividendYield'] or 0) * (holding.allocation / 100)
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
    
    # Calculate goal probability from results
    # We use the percentile data to estimate
    final_values = results["final_values"]
    
    # Estimate probability using normal approximation
    import numpy as np
    mean = final_values["mean"]
    std = final_values["std"]
    
    if std > 0:
        z_score = (target_amount - mean) / std
        probability = 1 - 0.5 * (1 + np.math.erf(z_score / np.sqrt(2)))
    else:
        probability = 1.0 if mean >= target_amount else 0.0
    
    return {
        "target_amount": target_amount,
        "probability": float(probability),
        "expected_final_value": mean,
        "percentile_outcomes": final_values["percentiles"],
        "time_horizon": request.time_horizon
    }
