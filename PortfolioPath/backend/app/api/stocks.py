"""
Stock Data API Endpoints
========================
Endpoints for fetching real-time and historical stock data.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel

from app.services.stock_service import stock_service


router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================

class TickerList(BaseModel):
    """Request model for batch ticker operations."""
    tickers: List[str]


class StockQuote(BaseModel):
    """Stock quote response model."""
    ticker: str
    price: float
    change: float
    changePercent: float
    name: str
    volume: Optional[int] = None
    marketCap: Optional[int] = None
    sector: Optional[str] = None
    timestamp: str


class StockStatistics(BaseModel):
    """Stock statistics for simulation."""
    ticker: str
    meanDailyReturn: float
    dailyVolatility: float
    annualizedReturn: float
    annualizedVolatility: float
    sharpeRatio: float
    maxDrawdown: float
    beta: float
    dataPoints: int
    period: str


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/quote/{ticker}", response_model=StockQuote)
async def get_stock_quote(ticker: str):
    """
    Get real-time quote for a stock ticker.
    
    - **ticker**: Stock symbol (e.g., AAPL, MSFT, SPY)
    """
    result = await stock_service.get_quote(ticker.upper())
    
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Ticker '{ticker}' not found or data unavailable"
        )
    
    return result


@router.post("/quotes")
async def get_batch_quotes(request: TickerList):
    """
    Get quotes for multiple tickers at once.
    
    - **tickers**: List of stock symbols
    """
    if len(request.tickers) > 20:
        raise HTTPException(
            status_code=400,
            detail="Maximum 20 tickers per request"
        )
    
    results = await stock_service.get_batch_quotes(request.tickers)
    return {"quotes": results, "count": len(results)}


@router.get("/history/{ticker}")
async def get_historical_data(
    ticker: str,
    period: str = Query("1y", regex="^(1d|5d|1mo|3mo|6mo|1y|2y|5y|10y|ytd|max)$"),
    interval: str = Query("1d", regex="^(1m|2m|5m|15m|30m|60m|90m|1h|1d|5d|1wk|1mo|3mo)$")
):
    """
    Get historical price data for a ticker.
    
    - **ticker**: Stock symbol
    - **period**: Time period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
    - **interval**: Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
    """
    result = await stock_service.get_historical_data(ticker.upper(), period, interval)
    
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Historical data not available for '{ticker}'"
        )
    
    return result


@router.get("/statistics/{ticker}", response_model=StockStatistics)
async def get_stock_statistics(
    ticker: str,
    period: str = Query("1y", regex="^(3mo|6mo|1y|2y|5y)$")
):
    """
    Get statistical parameters for Monte Carlo simulation.
    
    - **ticker**: Stock symbol
    - **period**: Historical period for calculation (3mo, 6mo, 1y, 2y, 5y)
    
    Returns mean return, volatility, Sharpe ratio, beta, and other metrics.
    """
    result = await stock_service.calculate_statistics(ticker.upper(), period)
    
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Unable to calculate statistics for '{ticker}'"
        )
    
    return result


@router.post("/statistics")
async def get_batch_statistics(
    request: TickerList,
    period: str = Query("1y", regex="^(3mo|6mo|1y|2y|5y)$")
):
    """
    Get statistics for multiple tickers.
    """
    if len(request.tickers) > 10:
        raise HTTPException(
            status_code=400,
            detail="Maximum 10 tickers per request"
        )
    
    results = {}
    for ticker in request.tickers:
        stats = await stock_service.calculate_statistics(ticker.upper(), period)
        if stats:
            results[ticker.upper()] = stats
    
    return {"statistics": results, "count": len(results)}


@router.post("/correlation")
async def get_correlation_matrix(
    request: TickerList,
    period: str = Query("1y", regex="^(3mo|6mo|1y|2y|5y)$")
):
    """
    Calculate correlation matrix for a list of tickers.
    
    Uses historical returns to compute pairwise correlations.
    """
    if len(request.tickers) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 tickers required for correlation"
        )
    
    if len(request.tickers) > 15:
        raise HTTPException(
            status_code=400,
            detail="Maximum 15 tickers per correlation matrix"
        )
    
    result = await stock_service.get_correlation_matrix(request.tickers, period)
    
    if not result:
        raise HTTPException(
            status_code=404,
            detail="Unable to calculate correlation matrix"
        )
    
    return result


@router.get("/validate/{ticker}")
async def validate_ticker(ticker: str):
    """
    Validate if a ticker symbol exists.
    """
    is_valid = await stock_service.validate_ticker(ticker.upper())
    return {"ticker": ticker.upper(), "valid": is_valid}


@router.get("/search")
async def search_tickers(
    q: str = Query(..., min_length=1, max_length=10),
    limit: int = Query(10, ge=1, le=50)
):
    """
    Search for tickers by name or symbol.
    
    - **q**: Search query
    - **limit**: Maximum results to return
    """
    results = await stock_service.search_tickers(q, limit)
    return {"results": results, "count": len(results)}
