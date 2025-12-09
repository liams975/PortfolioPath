"""Stock data API endpoints."""
import re
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from app.services.stock_service import StockService

router = APIRouter(prefix="/api/stocks", tags=["Stocks"])

# Ticker validation regex (alphanumeric, hyphens, dots, max 10 chars)
TICKER_PATTERN = re.compile(r'^[A-Z0-9.\-]{1,10}$')


def validate_ticker_symbol(ticker: str) -> str:
    """Validate and sanitize ticker symbol."""
    ticker = ticker.upper().strip()
    if not TICKER_PATTERN.match(ticker):
        raise ValueError(f"Invalid ticker symbol: {ticker}")
    return ticker


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


class Statistics(BaseModel):
    """Historical statistics."""
    mean_return: float
    volatility: float
    sharpe_ratio: float
    max_drawdown: float
    total_return: float


# ============ Endpoints ============

@router.get("/quote/{ticker}", response_model=StockQuote)
async def get_quote(ticker: str):
    """
    Get current stock quote for a ticker.
    
    - **ticker**: Stock ticker symbol (e.g., AAPL, MSFT, GOOGL)
    """
    try:
        ticker = validate_ticker_symbol(ticker)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    quote = await StockService.get_quote(ticker)
    
    if not quote:
        raise HTTPException(
            status_code=404,
            detail=f"Could not fetch quote for ticker: {ticker}"
        )
    
    return StockQuote(**quote)


class BatchTickersRequest(BaseModel):
    """Request model for batch ticker quotes."""
    tickers: List[str] = Field(..., min_length=1, max_length=20)
    
    @field_validator('tickers')
    @classmethod
    def validate_tickers(cls, v: List[str]) -> List[str]:
        """Validate all ticker symbols."""
        validated = []
        for ticker in v:
            try:
                validated.append(validate_ticker_symbol(ticker))
            except ValueError as e:
                raise ValueError(f"Invalid ticker in list: {ticker}")
        return validated


@router.post("/batch")
async def get_batch_quotes(request: BatchTickersRequest):
    """
    Get quotes for multiple tickers at once.
    
    - **tickers**: List of ticker symbols (max 20)
    """
    quotes = await StockService.get_batch_quotes(request.tickers)
    
    return {
        "quotes": quotes,
        "count": len(quotes),
        "missing": [t for t in request.tickers if t not in quotes]
    }


@router.get("/historical/{ticker}")
async def get_historical(
    ticker: str,
    period: str = Query(default="5y", regex="^(1mo|3mo|6mo|1y|2y|5y|10y|max)$"),
    interval: str = Query(default="1d", regex="^(1d|1wk|1mo)$"),
    target_days: Optional[int] = Query(default=None, ge=21, le=5040, description="Target time horizon in trading days for weighted averaging. If specified, recent data gets exponentially more weight.")
):
    """
    Get historical price data for a ticker with optional weighted statistics.
    
    - **ticker**: Stock ticker symbol
    - **period**: Time period (1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, max)
    - **interval**: Data interval (1d, 1wk, 1mo)
    - **target_days**: Target time horizon in trading days for weighted averaging (21-5040 days).
                      If specified, calculates statistics with exponential weighting,
                      giving more weight to recent data. Default 252 days = 1 year.
    """
    try:
        ticker = validate_ticker_symbol(ticker)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    data = await StockService.get_historical(ticker, period, interval, target_days)
    
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
    try:
        ticker = validate_ticker_symbol(ticker)
    except ValueError as e:
        return ValidationResult(ticker=ticker.upper(), valid=False, name=None)
    
    is_valid = await StockService.validate_ticker(ticker)
    
    name = None
    if is_valid:
        quote = await StockService.get_quote(ticker)
        if quote:
            name = quote.get("name")
    
    return ValidationResult(
        ticker=ticker,
        valid=is_valid,
        name=name
    )


@router.get("/search", response_model=List[SearchResult])
async def search_tickers(q: str = Query(..., min_length=1, max_length=50)):
    """
    Search for ticker symbols by name or symbol.
    
    - **q**: Search query (1-50 characters)
    """
    # Sanitize search query
    q = q.strip()[:50]
    if not q:
        raise HTTPException(status_code=400, detail="Search query cannot be empty")
    
    results = await StockService.search_tickers(q)
    return [SearchResult(**r) for r in results]


class CorrelationRequest(BaseModel):
    """Request model for correlation matrix."""
    tickers: List[str] = Field(..., min_length=2, max_length=10)
    period: str = Field(default="5y")
    
    @field_validator('tickers')
    @classmethod
    def validate_tickers(cls, v: List[str]) -> List[str]:
        """Validate all ticker symbols."""
        validated = []
        for ticker in v:
            try:
                validated.append(validate_ticker_symbol(ticker))
            except ValueError as e:
                raise ValueError(f"Invalid ticker in list: {ticker}")
        return validated
    
    @field_validator('period')
    @classmethod
    def validate_period(cls, v: str) -> str:
        """Validate period parameter."""
        valid_periods = ['3mo', '6mo', '1y', '2y', '5y']
        if v not in valid_periods:
            raise ValueError(f"Period must be one of: {', '.join(valid_periods)}")
        return v


@router.post("/correlation")
async def get_correlation(request: CorrelationRequest):
    """
    Get correlation matrix for multiple tickers.
    
    - **tickers**: List of ticker symbols (2-10 tickers)
    - **period**: Time period for calculation (3mo, 6mo, 1y, 2y, 5y)
    """
    result = await StockService.get_correlation_matrix(request.tickers, request.period)
    
    if not result:
        raise HTTPException(
            status_code=404,
            detail="Could not calculate correlation matrix"
        )
    
    return result
