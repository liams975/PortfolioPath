"""Stock data service using yfinance."""
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from functools import lru_cache
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Thread pool for running yfinance in async context
executor = ThreadPoolExecutor(max_workers=4)


class StockService:
    """Service for fetching stock data from Yahoo Finance."""
    
    # Cache for ticker validation
    _valid_tickers: Dict[str, bool] = {}
    
    @staticmethod
    def _sync_get_quote(ticker: str) -> Optional[Dict[str, Any]]:
        """Synchronously get a stock quote."""
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            
            # Check if we got valid data
            if not info or info.get('regularMarketPrice') is None:
                # Try fast_info as fallback
                try:
                    fast_info = stock.fast_info
                    if hasattr(fast_info, 'last_price') and fast_info.last_price:
                        return {
                            "ticker": ticker.upper(),
                            "price": fast_info.last_price,
                            "name": ticker.upper(),
                            "change": 0,
                            "changePercent": 0,
                            "volume": getattr(fast_info, 'last_volume', 0) or 0,
                            "marketCap": getattr(fast_info, 'market_cap', 0) or 0,
                        }
                except:
                    pass
                return None
            
            return {
                "ticker": ticker.upper(),
                "price": info.get('regularMarketPrice', 0),
                "previousClose": info.get('regularMarketPreviousClose', 0),
                "name": info.get('shortName', ticker.upper()),
                "change": info.get('regularMarketChange', 0),
                "changePercent": info.get('regularMarketChangePercent', 0),
                "dayHigh": info.get('regularMarketDayHigh', 0),
                "dayLow": info.get('regularMarketDayLow', 0),
                "volume": info.get('regularMarketVolume', 0),
                "marketCap": info.get('marketCap', 0),
                "fiftyTwoWeekHigh": info.get('fiftyTwoWeekHigh', 0),
                "fiftyTwoWeekLow": info.get('fiftyTwoWeekLow', 0),
                "dividendYield": info.get('dividendYield', 0),
                "sector": info.get('sector', ''),
                "industry": info.get('industry', ''),
            }
        except Exception as e:
            print(f"Error fetching quote for {ticker}: {e}")
            return None
    
    @staticmethod
    async def get_quote(ticker: str) -> Optional[Dict[str, Any]]:
        """Get a stock quote asynchronously."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            executor,
            StockService._sync_get_quote,
            ticker
        )
    
    @staticmethod
    def _sync_get_batch_quotes(tickers: List[str]) -> Dict[str, Dict[str, Any]]:
        """Synchronously get multiple stock quotes."""
        results = {}
        for ticker in tickers:
            quote = StockService._sync_get_quote(ticker)
            if quote:
                results[ticker.upper()] = quote
        return results
    
    @staticmethod
    async def get_batch_quotes(tickers: List[str]) -> Dict[str, Dict[str, Any]]:
        """Get multiple stock quotes asynchronously."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            executor,
            StockService._sync_get_batch_quotes,
            tickers
        )
    
    @staticmethod
    def _sync_get_historical(
        ticker: str,
        period: str = "5y",
        interval: str = "1d"
    ) -> Optional[Dict[str, Any]]:
        """Synchronously get historical data."""
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period=period, interval=interval)
            
            if hist.empty:
                return None
            
            # Calculate returns
            hist['Returns'] = hist['Close'].pct_change()
            
            # Calculate statistics
            returns = hist['Returns'].dropna()
            
            return {
                "ticker": ticker.upper(),
                "data": [
                    {
                        "date": date.strftime('%Y-%m-%d'),
                        "open": row['Open'],
                        "high": row['High'],
                        "low": row['Low'],
                        "close": row['Close'],
                        "volume": row['Volume'],
                        "return": row['Returns'] if not pd.isna(row['Returns']) else 0
                    }
                    for date, row in hist.iterrows()
                ],
                "statistics": {
                    "mean_return": float(returns.mean() * 252),  # Annualized
                    "volatility": float(returns.std() * np.sqrt(252)),  # Annualized
                    "sharpe_ratio": float((returns.mean() * 252) / (returns.std() * np.sqrt(252))) if returns.std() > 0 else 0,
                    "max_drawdown": float(StockService._calculate_max_drawdown(hist['Close'])),
                    "total_return": float((hist['Close'].iloc[-1] / hist['Close'].iloc[0]) - 1),
                }
            }
        except Exception as e:
            print(f"Error fetching historical data for {ticker}: {e}")
            return None
    
    @staticmethod
    def _calculate_max_drawdown(prices: pd.Series) -> float:
        """Calculate maximum drawdown from price series."""
        peak = prices.expanding(min_periods=1).max()
        drawdown = (prices - peak) / peak
        return float(drawdown.min())
    
    @staticmethod
    async def get_historical(
        ticker: str,
        period: str = "5y",
        interval: str = "1d"
    ) -> Optional[Dict[str, Any]]:
        """Get historical data asynchronously."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            executor,
            StockService._sync_get_historical,
            ticker,
            period,
            interval
        )
    
    @staticmethod
    def _sync_validate_ticker(ticker: str) -> bool:
        """Synchronously validate a ticker."""
        # Check cache first
        if ticker.upper() in StockService._valid_tickers:
            return StockService._valid_tickers[ticker.upper()]
        
        try:
            stock = yf.Ticker(ticker)
            # Try to get some data to validate
            hist = stock.history(period="5d")
            is_valid = not hist.empty
            
            # Cache the result
            StockService._valid_tickers[ticker.upper()] = is_valid
            return is_valid
        except:
            StockService._valid_tickers[ticker.upper()] = False
            return False
    
    @staticmethod
    async def validate_ticker(ticker: str) -> bool:
        """Validate a ticker asynchronously."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            executor,
            StockService._sync_validate_ticker,
            ticker
        )
    
    @staticmethod
    def _sync_search_tickers(query: str) -> List[Dict[str, str]]:
        """Synchronously search for tickers."""
        # Common tickers for quick search
        common_tickers = {
            "AAPL": "Apple Inc.",
            "MSFT": "Microsoft Corporation",
            "GOOGL": "Alphabet Inc.",
            "GOOG": "Alphabet Inc. Class C",
            "AMZN": "Amazon.com Inc.",
            "NVDA": "NVIDIA Corporation",
            "META": "Meta Platforms Inc.",
            "TSLA": "Tesla Inc.",
            "BRK-B": "Berkshire Hathaway Inc.",
            "JPM": "JPMorgan Chase & Co.",
            "V": "Visa Inc.",
            "JNJ": "Johnson & Johnson",
            "UNH": "UnitedHealth Group Inc.",
            "HD": "Home Depot Inc.",
            "PG": "Procter & Gamble Co.",
            "MA": "Mastercard Inc.",
            "DIS": "Walt Disney Co.",
            "PYPL": "PayPal Holdings Inc.",
            "NFLX": "Netflix Inc.",
            "ADBE": "Adobe Inc.",
            "CRM": "Salesforce Inc.",
            "INTC": "Intel Corporation",
            "AMD": "Advanced Micro Devices Inc.",
            "BA": "Boeing Co.",
            "NKE": "Nike Inc.",
            "SPY": "SPDR S&P 500 ETF Trust",
            "QQQ": "Invesco QQQ Trust",
            "VTI": "Vanguard Total Stock Market ETF",
            "VOO": "Vanguard S&P 500 ETF",
            "BND": "Vanguard Total Bond Market ETF",
        }
        
        query_upper = query.upper()
        results = []
        
        for ticker, name in common_tickers.items():
            if query_upper in ticker or query.lower() in name.lower():
                results.append({"ticker": ticker, "name": name})
        
        return results[:10]  # Limit to 10 results
    
    @staticmethod
    async def search_tickers(query: str) -> List[Dict[str, str]]:
        """Search for tickers asynchronously."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            executor,
            StockService._sync_search_tickers,
            query
        )
    
    @staticmethod
    def _sync_get_correlation_matrix(
        tickers: List[str],
        period: str = "5y"
    ) -> Optional[Dict[str, Any]]:
        """Synchronously calculate correlation matrix."""
        try:
            # Download data for all tickers
            data = yf.download(tickers, period=period, progress=False)['Close']
            
            if data.empty:
                return None
            
            # Calculate returns
            returns = data.pct_change().dropna()
            
            # Calculate correlation matrix
            corr_matrix = returns.corr()
            
            return {
                "tickers": tickers,
                "matrix": corr_matrix.values.tolist(),
                "labels": corr_matrix.columns.tolist()
            }
        except Exception as e:
            print(f"Error calculating correlation matrix: {e}")
            return None
    
    @staticmethod
    async def get_correlation_matrix(
        tickers: List[str],
        period: str = "5y"
    ) -> Optional[Dict[str, Any]]:
        """Calculate correlation matrix asynchronously."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            executor,
            StockService._sync_get_correlation_matrix,
            tickers,
            period
        )
