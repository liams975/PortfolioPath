"""
Stock Data Service
==================
Fetches real-time and historical stock data using yfinance.
"""

import yfinance as yf
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from functools import lru_cache
import asyncio
from concurrent.futures import ThreadPoolExecutor


# Thread pool for running yfinance in async context
executor = ThreadPoolExecutor(max_workers=4)


class StockDataService:
    """Service for fetching stock market data."""
    
    # Cache for stock info (expires after 5 minutes)
    _cache: Dict[str, Dict] = {}
    _cache_time: Dict[str, datetime] = {}
    CACHE_TTL = 300  # 5 minutes
    
    @classmethod
    def _is_cache_valid(cls, ticker: str) -> bool:
        """Check if cached data is still valid."""
        if ticker not in cls._cache_time:
            return False
        return (datetime.now() - cls._cache_time[ticker]).seconds < cls.CACHE_TTL
    
    @classmethod
    async def get_quote(cls, ticker: str) -> Dict[str, Any]:
        """
        Get current stock quote.
        
        Returns:
            {
                "ticker": "AAPL",
                "price": 175.50,
                "change": 2.35,
                "changePercent": 1.36,
                "name": "Apple Inc.",
                "volume": 52345678,
                "marketCap": 2750000000000,
                "timestamp": "2024-01-15T16:00:00"
            }
        """
        if cls._is_cache_valid(ticker):
            return cls._cache[ticker]
        
        def fetch():
            try:
                stock = yf.Ticker(ticker)
                info = stock.info
                
                # Get current price data
                hist = stock.history(period="2d")
                if hist.empty:
                    return None
                
                current_price = hist['Close'].iloc[-1]
                prev_close = hist['Close'].iloc[-2] if len(hist) > 1 else current_price
                change = current_price - prev_close
                change_pct = (change / prev_close) * 100 if prev_close else 0
                
                return {
                    "ticker": ticker.upper(),
                    "price": round(current_price, 2),
                    "change": round(change, 2),
                    "changePercent": round(change_pct, 2),
                    "name": info.get("longName", info.get("shortName", ticker)),
                    "volume": info.get("volume", 0),
                    "marketCap": info.get("marketCap", 0),
                    "sector": info.get("sector", "Unknown"),
                    "industry": info.get("industry", "Unknown"),
                    "fiftyTwoWeekHigh": info.get("fiftyTwoWeekHigh", 0),
                    "fiftyTwoWeekLow": info.get("fiftyTwoWeekLow", 0),
                    "timestamp": datetime.now().isoformat()
                }
            except Exception as e:
                print(f"Error fetching {ticker}: {e}")
                return None
        
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(executor, fetch)
        
        if result:
            cls._cache[ticker] = result
            cls._cache_time[ticker] = datetime.now()
        
        return result
    
    @classmethod
    async def get_batch_quotes(cls, tickers: List[str]) -> Dict[str, Any]:
        """Get quotes for multiple tickers."""
        tasks = [cls.get_quote(ticker) for ticker in tickers]
        results = await asyncio.gather(*tasks)
        return {
            ticker: result 
            for ticker, result in zip(tickers, results) 
            if result is not None
        }
    
    @classmethod
    async def get_historical_data(
        cls, 
        ticker: str, 
        period: str = "1y",
        interval: str = "1d"
    ) -> Dict[str, Any]:
        """
        Get historical price data.
        
        Args:
            ticker: Stock ticker symbol
            period: Time period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
            interval: Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
        """
        def fetch():
            try:
                stock = yf.Ticker(ticker)
                hist = stock.history(period=period, interval=interval)
                
                if hist.empty:
                    return None
                
                # Convert to serializable format
                data = []
                for date, row in hist.iterrows():
                    data.append({
                        "date": date.isoformat(),
                        "open": round(row["Open"], 2),
                        "high": round(row["High"], 2),
                        "low": round(row["Low"], 2),
                        "close": round(row["Close"], 2),
                        "volume": int(row["Volume"])
                    })
                
                return {
                    "ticker": ticker.upper(),
                    "period": period,
                    "interval": interval,
                    "data": data,
                    "count": len(data)
                }
            except Exception as e:
                print(f"Error fetching historical data for {ticker}: {e}")
                return None
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(executor, fetch)
    
    @classmethod
    async def calculate_statistics(cls, ticker: str, period: str = "1y") -> Dict[str, Any]:
        """
        Calculate statistical parameters for Monte Carlo simulation.
        
        Returns:
            {
                "ticker": "AAPL",
                "meanDailyReturn": 0.0005,
                "dailyVolatility": 0.018,
                "annualizedReturn": 0.126,
                "annualizedVolatility": 0.286,
                "sharpeRatio": 0.88,
                "maxDrawdown": -0.15,
                "beta": 1.2
            }
        """
        def fetch():
            try:
                stock = yf.Ticker(ticker)
                hist = stock.history(period=period)
                
                if hist.empty or len(hist) < 20:
                    return None
                
                # Calculate daily returns
                returns = hist['Close'].pct_change().dropna()
                
                # Basic statistics
                mean_daily = returns.mean()
                std_daily = returns.std()
                
                # Annualized metrics (252 trading days)
                annualized_return = mean_daily * 252
                annualized_vol = std_daily * np.sqrt(252)
                
                # Sharpe ratio (assuming risk-free rate of 4%)
                risk_free_rate = 0.04
                sharpe = (annualized_return - risk_free_rate) / annualized_vol if annualized_vol > 0 else 0
                
                # Maximum drawdown
                cumulative = (1 + returns).cumprod()
                rolling_max = cumulative.expanding().max()
                drawdowns = (cumulative - rolling_max) / rolling_max
                max_drawdown = drawdowns.min()
                
                # Skewness and Kurtosis
                skewness = returns.skew()
                kurtosis = returns.kurtosis()
                
                # Beta calculation (vs SPY)
                try:
                    spy = yf.Ticker("SPY")
                    spy_hist = spy.history(period=period)
                    spy_returns = spy_hist['Close'].pct_change().dropna()
                    
                    # Align dates
                    aligned = pd.concat([returns, spy_returns], axis=1, join='inner')
                    aligned.columns = ['stock', 'market']
                    
                    covariance = aligned['stock'].cov(aligned['market'])
                    market_variance = aligned['market'].var()
                    beta = covariance / market_variance if market_variance > 0 else 1.0
                except:
                    beta = 1.0
                
                return {
                    "ticker": ticker.upper(),
                    "meanDailyReturn": round(mean_daily, 6),
                    "dailyVolatility": round(std_daily, 6),
                    "annualizedReturn": round(annualized_return, 4),
                    "annualizedVolatility": round(annualized_vol, 4),
                    "sharpeRatio": round(sharpe, 3),
                    "maxDrawdown": round(max_drawdown, 4),
                    "skewness": round(skewness, 4),
                    "kurtosis": round(kurtosis, 4),
                    "beta": round(beta, 3),
                    "dataPoints": len(returns),
                    "period": period
                }
            except Exception as e:
                print(f"Error calculating statistics for {ticker}: {e}")
                return None
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(executor, fetch)
    
    @classmethod
    async def get_correlation_matrix(cls, tickers: List[str], period: str = "1y") -> Dict[str, Any]:
        """
        Calculate correlation matrix for a list of tickers.
        """
        def fetch():
            try:
                # Fetch historical data for all tickers
                data = {}
                for ticker in tickers:
                    stock = yf.Ticker(ticker)
                    hist = stock.history(period=period)
                    if not hist.empty:
                        data[ticker] = hist['Close'].pct_change().dropna()
                
                if len(data) < 2:
                    return None
                
                # Create DataFrame and calculate correlation
                df = pd.DataFrame(data)
                corr_matrix = df.corr()
                
                # Convert to serializable format
                matrix = []
                for i, t1 in enumerate(corr_matrix.index):
                    row = []
                    for j, t2 in enumerate(corr_matrix.columns):
                        row.append(round(corr_matrix.iloc[i, j], 4))
                    matrix.append(row)
                
                return {
                    "tickers": list(corr_matrix.index),
                    "matrix": matrix,
                    "period": period
                }
            except Exception as e:
                print(f"Error calculating correlation matrix: {e}")
                return None
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(executor, fetch)
    
    @classmethod
    async def validate_ticker(cls, ticker: str) -> bool:
        """Check if a ticker symbol is valid."""
        def fetch():
            try:
                stock = yf.Ticker(ticker)
                info = stock.info
                # Check if we got meaningful data
                return info.get("regularMarketPrice") is not None or info.get("previousClose") is not None
            except:
                return False
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(executor, fetch)
    
    @classmethod
    async def search_tickers(cls, query: str, limit: int = 10) -> List[Dict[str, str]]:
        """Search for tickers by name or symbol."""
        # Note: yfinance doesn't have search functionality
        # This is a placeholder - in production, use a service like Yahoo Finance API
        
        # Common tickers for demo
        COMMON_TICKERS = {
            "SPY": "SPDR S&P 500 ETF",
            "QQQ": "Invesco QQQ Trust",
            "AAPL": "Apple Inc.",
            "MSFT": "Microsoft Corporation",
            "GOOGL": "Alphabet Inc.",
            "AMZN": "Amazon.com Inc.",
            "NVDA": "NVIDIA Corporation",
            "META": "Meta Platforms Inc.",
            "TSLA": "Tesla Inc.",
            "BRK.B": "Berkshire Hathaway Inc.",
            "JPM": "JPMorgan Chase & Co.",
            "V": "Visa Inc.",
            "JNJ": "Johnson & Johnson",
            "WMT": "Walmart Inc.",
            "PG": "Procter & Gamble Co.",
            "VTI": "Vanguard Total Stock Market ETF",
            "BND": "Vanguard Total Bond Market ETF",
            "GLD": "SPDR Gold Shares",
            "IWM": "iShares Russell 2000 ETF",
            "VEA": "Vanguard FTSE Developed Markets ETF",
            "VWO": "Vanguard FTSE Emerging Markets ETF",
            "TLT": "iShares 20+ Year Treasury Bond ETF",
            "AGG": "iShares Core U.S. Aggregate Bond ETF",
            "XOM": "Exxon Mobil Corporation",
            "AMD": "Advanced Micro Devices Inc.",
            "INTC": "Intel Corporation",
            "NFLX": "Netflix Inc.",
            "DIS": "The Walt Disney Company",
            "GOOG": "Alphabet Inc. Class C",
        }
        
        query_upper = query.upper()
        results = []
        
        for ticker, name in COMMON_TICKERS.items():
            if query_upper in ticker or query.lower() in name.lower():
                results.append({"ticker": ticker, "name": name})
                if len(results) >= limit:
                    break
        
        return results


# Singleton instance
stock_service = StockDataService()
