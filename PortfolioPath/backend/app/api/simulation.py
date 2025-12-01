"""
Monte Carlo Simulation API Endpoints
====================================
Endpoints for running portfolio simulations.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import asyncio

from app.services.monte_carlo import (
    MonteCarloEngine, 
    AssetParameters, 
    SimulationConfig,
    run_simulation_async
)
from app.services.stock_service import stock_service


router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================

class AssetInput(BaseModel):
    """Input model for a single asset in portfolio."""
    ticker: str = Field(..., example="SPY")
    weight: float = Field(..., ge=0, le=1, example=0.6)
    meanReturn: Optional[float] = Field(None, description="Daily mean return (auto-fetched if not provided)")
    volatility: Optional[float] = Field(None, description="Daily volatility (auto-fetched if not provided)")


class SimulationRequest(BaseModel):
    """Request model for Monte Carlo simulation."""
    portfolio: List[AssetInput] = Field(..., min_length=1, max_length=20)
    initialValue: float = Field(10000, gt=0, example=10000)
    timeHorizon: int = Field(252, ge=1, le=2520, example=252)  # Max ~10 years
    numSimulations: int = Field(1000, ge=100, le=10000, example=1000)
    
    # Model options
    useCorrelation: bool = Field(True)
    useFatTails: bool = Field(True)
    useGarch: bool = Field(True)
    useRegimeSwitching: bool = Field(True)
    useJumpDiffusion: bool = Field(True)
    
    # Scenario modifiers
    scenarios: Optional[Dict[str, bool]] = Field(default_factory=dict)


class GoalProbabilityRequest(BaseModel):
    """Request model for goal probability calculation."""
    portfolio: List[AssetInput]
    initialValue: float = Field(10000, gt=0)
    targetValue: float = Field(..., gt=0, example=15000)
    timeHorizon: int = Field(252, ge=1, le=2520)
    numSimulations: int = Field(1000, ge=100, le=10000)


class SimulationMetrics(BaseModel):
    """Simulation result metrics."""
    meanReturn: float
    volatility: float
    sharpeRatio: float
    var95: float
    var99: float
    expectedShortfall: float
    skewness: float
    kurtosis: float
    probProfit: float


class SimulationResponse(BaseModel):
    """Response model for simulation results."""
    metrics: SimulationMetrics
    percentiles: Dict[str, float]
    drawdowns: Dict[str, float]
    fanChartData: List[Dict[str, Any]]
    samplePaths: List[List[float]]
    numSimulations: int
    timeHorizon: int


# ============================================================================
# Helper Functions
# ============================================================================

async def fetch_asset_parameters(assets: List[AssetInput]) -> List[Dict]:
    """Fetch real statistics for assets that don't have them provided."""
    enriched_assets = []
    
    for asset in assets:
        asset_dict = {
            "ticker": asset.ticker.upper(),
            "weight": asset.weight
        }
        
        # If parameters not provided, fetch from yfinance
        if asset.meanReturn is None or asset.volatility is None:
            stats = await stock_service.calculate_statistics(asset.ticker, "1y")
            if stats:
                asset_dict["meanReturn"] = stats.get("meanDailyReturn", 0.0003)
                asset_dict["volatility"] = stats.get("dailyVolatility", 0.015)
            else:
                # Default fallback values
                asset_dict["meanReturn"] = 0.0003
                asset_dict["volatility"] = 0.015
        else:
            asset_dict["meanReturn"] = asset.meanReturn
            asset_dict["volatility"] = asset.volatility
        
        enriched_assets.append(asset_dict)
    
    return enriched_assets


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/run", response_model=SimulationResponse)
async def run_simulation(request: SimulationRequest):
    """
    Run Monte Carlo simulation on a portfolio.
    
    **Portfolio**: List of assets with tickers and weights (must sum to 1.0)
    
    **Model Options**:
    - useCorrelation: Model asset correlations using Cholesky decomposition
    - useFatTails: Use Student-t distribution for extreme events
    - useGarch: GARCH(1,1) volatility clustering
    - useRegimeSwitching: Bull/Bear market regime switching
    - useJumpDiffusion: Merton jump diffusion for sudden shocks
    
    **Returns**: Simulation metrics, percentiles, sample paths, and fan chart data
    """
    # Validate weights sum to 1
    total_weight = sum(asset.weight for asset in request.portfolio)
    if abs(total_weight - 1.0) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Portfolio weights must sum to 1.0 (got {total_weight:.2f})"
        )
    
    try:
        # Fetch real parameters for assets
        enriched_assets = await fetch_asset_parameters(request.portfolio)
        
        # Build config
        config = {
            "initialValue": request.initialValue,
            "timeHorizon": request.timeHorizon,
            "numSimulations": request.numSimulations,
            "useCorrelation": request.useCorrelation,
            "useFatTails": request.useFatTails,
            "useGarch": request.useGarch,
            "useRegimeSwitching": request.useRegimeSwitching,
            "useJumpDiffusion": request.useJumpDiffusion
        }
        
        # Fetch correlation matrix
        tickers = [a["ticker"] for a in enriched_assets]
        correlation_data = await stock_service.get_correlation_matrix(tickers, "1y")
        correlation_matrix = correlation_data["matrix"] if correlation_data else None
        
        # Run simulation
        result = await run_simulation_async(enriched_assets, config, correlation_matrix)
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Simulation failed: {str(e)}"
        )


@router.post("/goal-probability")
async def calculate_goal_probability(request: GoalProbabilityRequest):
    """
    Calculate the probability of reaching a financial goal.
    
    **Returns**:
    - probability: Percentage chance of reaching target
    - successCount: Number of simulations that reached target
    - medianCrossingDay: Day when median path crosses target (if ever)
    """
    # Validate weights
    total_weight = sum(asset.weight for asset in request.portfolio)
    if abs(total_weight - 1.0) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Portfolio weights must sum to 1.0 (got {total_weight:.2f})"
        )
    
    if request.targetValue <= request.initialValue:
        raise HTTPException(
            status_code=400,
            detail="Target value must be greater than initial value"
        )
    
    try:
        # Fetch parameters and run simulation
        enriched_assets = await fetch_asset_parameters(request.portfolio)
        
        config = {
            "initialValue": request.initialValue,
            "timeHorizon": request.timeHorizon,
            "numSimulations": request.numSimulations,
            "useCorrelation": True,
            "useFatTails": True,
            "useGarch": True,
            "useRegimeSwitching": True,
            "useJumpDiffusion": True
        }
        
        # Run simulation (using simplified sync version for speed)
        engine = MonteCarloEngine()
        
        asset_params = [
            AssetParameters(
                ticker=a["ticker"],
                weight=a["weight"],
                mean_return=a["meanReturn"],
                volatility=a["volatility"]
            )
            for a in enriched_assets
        ]
        
        sim_config = SimulationConfig(
            initial_value=request.initialValue,
            time_horizon=request.timeHorizon,
            num_simulations=request.numSimulations
        )
        
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, 
            lambda: engine.run_simulation(asset_params, sim_config)
        )
        
        # Calculate goal probability
        goal_result = engine.calculate_goal_probability(result, request.targetValue)
        
        return {
            **goal_result,
            "metrics": result.metrics,
            "percentiles": result.percentiles
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Goal probability calculation failed: {str(e)}"
        )


@router.post("/quick")
async def quick_simulation(request: SimulationRequest):
    """
    Run a quick simulation with reduced parameters for faster response.
    
    Uses 500 simulations instead of the requested amount for speed.
    Good for real-time UI updates.
    """
    # Force reduced simulations for speed
    request.numSimulations = min(request.numSimulations, 500)
    
    return await run_simulation(request)


@router.get("/presets")
async def get_preset_portfolios():
    """
    Get preset portfolio templates.
    """
    presets = {
        "classic_60_40": {
            "name": "Classic 60/40",
            "description": "Traditional balanced portfolio",
            "portfolio": [
                {"ticker": "SPY", "weight": 0.6},
                {"ticker": "BND", "weight": 0.4}
            ],
            "risk": "Moderate"
        },
        "aggressive_growth": {
            "name": "Aggressive Growth",
            "description": "High risk, high reward tech focus",
            "portfolio": [
                {"ticker": "QQQ", "weight": 0.5},
                {"ticker": "AAPL", "weight": 0.2},
                {"ticker": "NVDA", "weight": 0.15},
                {"ticker": "TSLA", "weight": 0.15}
            ],
            "risk": "High"
        },
        "conservative": {
            "name": "Conservative",
            "description": "Capital preservation focus",
            "portfolio": [
                {"ticker": "BND", "weight": 0.5},
                {"ticker": "SPY", "weight": 0.3},
                {"ticker": "GLD", "weight": 0.2}
            ],
            "risk": "Low"
        },
        "all_weather": {
            "name": "All Weather",
            "description": "Ray Dalio inspired diversification",
            "portfolio": [
                {"ticker": "SPY", "weight": 0.3},
                {"ticker": "TLT", "weight": 0.4},
                {"ticker": "GLD", "weight": 0.15},
                {"ticker": "VWO", "weight": 0.15}
            ],
            "risk": "Moderate"
        },
        "tech_heavy": {
            "name": "Tech Heavy",
            "description": "Technology sector concentration",
            "portfolio": [
                {"ticker": "QQQ", "weight": 0.4},
                {"ticker": "MSFT", "weight": 0.2},
                {"ticker": "GOOGL", "weight": 0.2},
                {"ticker": "META", "weight": 0.2}
            ],
            "risk": "High"
        }
    }
    
    return {"presets": presets}
