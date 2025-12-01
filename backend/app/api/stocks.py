"""Stock data API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from app.services.stock_service import StockService

router = APIRouter(prefix="/api/stocks", tags=["Stocks"])


# ============ Response Models ============

class StockQuote(BaseModel):
    """Stock quote response."""
    ticker: str
    price: float
    name: str
    change: Optional[float] = 0
    changePercent: Optional[float] = 0
    volume: Optional[int] = 0
    marketCap: Optional[float] = 0
    previousClose: Optional[float] = 0
    dayHigh: Optional[float] = 0
    dayLow: Optional[float] = 0
    fiftyTwoWeekHigh: Optional[float] = 0
    fiftyTwoWeekLow: Optional[float] = 0
    dividendYield: Optional[float] = 0
    sector: Optional[str] = ""
    industry: Optional[str] = ""


class ValidationResult(BaseModel):
    """Ticker validation response."""
    ticker: str
    valid: bool
    name: Optional[str] = None


class SearchResult(BaseModel):
    """Ticker search result."""
    ticker: str
    name: str


class HistoricalDataPoint(BaseModel):
    """Single historical data point."""
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int
    return_pct: Optional[float] = 0


class Statistics(BaseModel):
    """Historical statistics."""
    mean_return: float
    volatility: float
    sharpe_ratio: float
    max_drawdown: float
    total_return: float


class HistoricalResponse(BaseModel):
    """Historical data response."""
    ticker: str
    statistics: Statistics
    data_points: int


# ============ Endpoints ============

@router.get("/quote/{ticker}", response_model=StockQuote)
async def get_quote(ticker: str):
    """
    Get current stock quote for a ticker.
    
    - **ticker**: Stock ticker symbol (e.g., AAPL, MSFT, GOOGL)
    """
    quote = await StockService.get_quote(ticker.upper())
    
    if not quote:
        raise HTTPException(
            status_code=404,
            detail=f"Could not fetch quote for ticker: {ticker}"
        )
    
    return StockQuote(**quote)


@router.post("/batch")
async def get_batch_quotes(tickers: List[str]):
    """
    Get quotes for multiple tickers at once.
    
    - **tickers**: List of ticker symbols
    """
    if not tickers:
        raise HTTPException(status_code=400, detail="No tickers provided")
    
    if len(tickers) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 tickers per request")
    
    quotes = await StockService.get_batch_quotes([t.upper() for t in tickers])
    
    return {
        "quotes": quotes,
        "count": len(quotes),
        "missing": [t.upper() for t in tickers if t.upper() not in quotes]
    }


@router.get("/historical/{ticker}")
async def get_historical(
    ticker: str,
    period: str = Query(default="5y", regex="^(1mo|3mo|6mo|1y|2y|5y|10y|max)$"),
    interval: str = Query(default="1d", regex="^(1d|1wk|1mo)$")
):
    """
    Get historical price data for a ticker.
    
    - **ticker**: Stock ticker symbol
    - **period**: Time period (1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, max)
    - **interval**: Data interval (1d, 1wk, 1mo)
    """
    data = await StockService.get_historical(ticker.upper(), period, interval)
    
    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"Could not fetch historical data for ticker: {ticker}"
        )
    
    return {
        "ticker": data["ticker"],
        "statistics": data["statistics"],
        "data_points": len(data["data"]),
        "data": data["data"][:100] if len(data["data"]) > 100 else data["data"]  # Limit response size
    }


@router.get("/validate/{ticker}", response_model=ValidationResult)
async def validate_ticker(ticker: str):
    """
    Validate if a ticker symbol exists.
    
    - **ticker**: Stock ticker symbol to validate
    """
    is_valid = await StockService.validate_ticker(ticker.upper())
    
    name = None
    if is_valid:
        quote = await StockService.get_quote(ticker.upper())
        if quote:
            name = quote.get("name")
    
    return ValidationResult(
        ticker=ticker.upper(),
        valid=is_valid,
        name=name
    )


@router.get("/search", response_model=List[SearchResult])
async def search_tickers(q: str = Query(..., min_length=1)):
    """
    Search for ticker symbols by name or symbol.
    
    - **q**: Search query
    """
    results = await StockService.search_tickers(q)
    return [SearchResult(**r) for r in results]


@router.post("/correlation")
async def get_correlation(tickers: List[str], period: str = "5y"):
    """
    Get correlation matrix for multiple tickers.
    
    - **tickers**: List of ticker symbols
    - **period**: Time period for calculation
    """
    if len(tickers) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 tickers")
    
    if len(tickers) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 tickers")
    
    result = await StockService.get_correlation_matrix([t.upper() for t in tickers], period)
    
    if not result:
        raise HTTPException(
            status_code=404,
            detail="Could not calculate correlation matrix"
        )
    
    return result
