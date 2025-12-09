"""Stock data service using yfinance."""
import yfinance as yf
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Any
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Shared thread pool for blocking yfinance calls
_executor = ThreadPoolExecutor(max_workers=4)


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
            _executor,
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
            _executor,
            StockService._sync_get_batch_quotes,
            tickers
        )
    
    @staticmethod
    def _calculate_exponential_weights(n_periods: int, half_life: int = 126) -> np.ndarray:
        """
        Calculate exponential weights for time series data.
        More recent data gets higher weight.
        
        Args:
            n_periods: Number of periods to weight
            half_life: Number of periods for weight to decay by half (default: 6 months)
        
        Returns:
            Normalized weight array (sums to 1)
        """
        decay = np.log(2) / half_life
        weights = np.exp(-decay * np.arange(n_periods)[::-1])  # Reverse so recent data has higher weight
        return weights / weights.sum()  # Normalize to sum to 1
    
    @staticmethod
    def _sync_get_historical(
        ticker: str,
        period: str = "5y",
        interval: str = "1d",
        target_days: int = None
    ) -> Optional[Dict[str, Any]]:
        """
        Synchronously get historical data with weighted statistics.
        
        If target_days is specified, calculates weighted statistics giving
        exponentially more weight to recent data up to target_days.
        
        Args:
            ticker: Stock ticker symbol
            period: yfinance period string (default: 5y to get ample data)
            interval: Data interval (default: 1d)
            target_days: Target time horizon in trading days for weighted average
                        If None, uses all data equally weighted
        """
        try:
            stock = yf.Ticker(ticker)
            # Always fetch maximum available data for better statistics
            hist = stock.history(period="max", interval=interval)
            
            if hist.empty:
                # Fallback to requested period
                hist = stock.history(period=period, interval=interval)
                if hist.empty:
                    return None
            
            # Calculate returns
            hist['Returns'] = hist['Close'].pct_change()
            returns = hist['Returns'].dropna()
            
            if len(returns) < 20:
                return None  # Not enough data
            
            # Calculate statistics
            # Use target_days to determine weighting scheme
            if target_days and target_days > 0:
                # Use exponential weighting with half-life based on target days
                # Half-life is set to half the target period for smooth weighting
                half_life = max(21, target_days // 2)  # Minimum 1 month half-life
                
                # Get the most relevant data (up to 3x target_days for stability)
                lookback = min(len(returns), target_days * 3)
                recent_returns = returns.tail(lookback)
                
                weights = StockService._calculate_exponential_weights(len(recent_returns), half_life)
                
                # Weighted mean and volatility
                weighted_mean = np.average(recent_returns.values, weights=weights)
                weighted_var = np.average((recent_returns.values - weighted_mean)**2, weights=weights)
                weighted_vol = np.sqrt(weighted_var)
                
                # Annualize
                mean_annual = weighted_mean * 252
                vol_annual = weighted_vol * np.sqrt(252)
            else:
                # Use equal weighting for all data (traditional approach)
                mean_annual = float(returns.mean() * 252)
                vol_annual = float(returns.std() * np.sqrt(252))
            
            sharpe = mean_annual / vol_annual if vol_annual > 0 else 0
            
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
                    "mean_return": float(mean_annual),  # Annualized weighted
                    "volatility": float(vol_annual),  # Annualized weighted
                    "sharpe_ratio": float(sharpe),
                    "max_drawdown": float(StockService._calculate_max_drawdown(hist['Close'])),
                    "total_return": float((hist['Close'].iloc[-1] / hist['Close'].iloc[0]) - 1),
                    "data_points": len(returns),
                    "weighted": target_days is not None,
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
        interval: str = "1d",
        target_days: int = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get historical data asynchronously with optional weighted statistics.
        
        Args:
            ticker: Stock ticker symbol
            period: yfinance period string (default: 5y)
            interval: Data interval (default: 1d)
            target_days: Target time horizon in trading days for weighted average
                        If specified, recent data gets exponentially more weight
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _executor,
            lambda: StockService._sync_get_historical(ticker, period, interval, target_days)
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
            _executor,
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
            _executor,
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
            _executor,
            StockService._sync_get_correlation_matrix,
            tickers,
            period
        )
