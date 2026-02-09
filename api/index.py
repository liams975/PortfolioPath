"""
PortfolioPath API - Vercel Serverless (Demo Version)
No authentication - pure stock data and simulation API
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import yfinance as yf
import pandas as pd
import numpy as np

app = FastAPI(
    title="PortfolioPath API",
    description="Monte Carlo Portfolio Simulation - Demo API",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ Models ============
class SimulationRequest(BaseModel):
    tickers: List[str]
    weights: List[float]
    initial_value: float = 10000
    time_horizon: int = 252
    num_simulations: int = 1000
    use_garch: bool = False
    use_regime_switching: bool = False
    use_jump_diffusion: bool = False
    monthly_contribution: float = 0

# ============ Health Endpoints ============
@app.get("/")
def root():
    return {"name": "PortfolioPath API", "version": "2.0.0", "status": "running"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/api/health")
def api_health():
    return {"status": "healthy", "version": "2.0.0"}

# ============ Stock Data Endpoints ============
@app.get("/api/stocks/{ticker}")
def get_stock_data(ticker: str, period: str = "1y"):
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period=period)
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No data found for {ticker}")
        
        info = stock.info
        return {
            "ticker": ticker.upper(),
            "name": info.get("longName", info.get("shortName", ticker)),
            "current_price": float(hist["Close"].iloc[-1]),
            "currency": info.get("currency", "USD"),
            "sector": info.get("sector", ""),
            "industry": info.get("industry", ""),
            "history": {
                "dates": hist.index.strftime("%Y-%m-%d").tolist(),
                "close": hist["Close"].tolist(),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/stocks/{ticker}/validate")
def validate_ticker(ticker: str):
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period="5d")
        if hist.empty:
            return {"valid": False, "ticker": ticker.upper()}
        info = stock.info
        return {
            "valid": True,
            "ticker": ticker.upper(),
            "name": info.get("longName", info.get("shortName", ticker)),
            "price": float(hist["Close"].iloc[-1])
        }
    except:
        return {"valid": False, "ticker": ticker.upper()}

@app.post("/api/stocks/batch")
def get_batch_stock_data(tickers: List[str], period: str = "1y"):
    results = {}
    for ticker in tickers[:10]:  # Limit to 10
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period=period)
            if not hist.empty:
                results[ticker.upper()] = {
                    "current_price": float(hist["Close"].iloc[-1]),
                    "returns": hist["Close"].pct_change().dropna().tolist()
                }
        except:
            pass
    return results

# ============ Simulation Endpoint ============
@app.post("/api/simulate")
def run_simulation(request: SimulationRequest):
    try:
        tickers = [t.upper() for t in request.tickers]
        data = {}
        
        # Fetch historical data
        for ticker in tickers:
            try:
                stock = yf.Ticker(ticker)
                hist = stock.history(period="2y")
                if not hist.empty:
                    data[ticker] = hist["Close"].pct_change().dropna()
            except:
                pass
        
        if not data:
            raise HTTPException(status_code=400, detail="Could not fetch data for any tickers")
        
        # Align data
        df = pd.DataFrame(data).dropna()
        if len(df) < 50:
            raise HTTPException(status_code=400, detail="Insufficient historical data")
        
        # Calculate statistics
        returns = df.values
        weights = np.array(request.weights[:len(tickers)])
        weights = weights / weights.sum()  # Normalize
        
        portfolio_returns = returns @ weights
        mu = np.mean(portfolio_returns) * 252
        sigma = np.std(portfolio_returns) * np.sqrt(252)
        
        # Run Monte Carlo
        dt = 1/252
        num_steps = request.time_horizon
        num_sims = min(request.num_simulations, 5000)  # Limit for serverless
        
        paths = np.zeros((num_sims, num_steps + 1))
        paths[:, 0] = request.initial_value
        
        for t in range(1, num_steps + 1):
            z = np.random.standard_normal(num_sims)
            paths[:, t] = paths[:, t-1] * np.exp((mu - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * z)
            # Add monthly contribution every 21 trading days
            if request.monthly_contribution > 0 and t % 21 == 0:
                paths[:, t] += request.monthly_contribution
        
        # Calculate percentiles
        percentiles = [5, 10, 25, 50, 75, 90, 95]
        percentile_paths = {p: np.percentile(paths, p, axis=0).tolist() for p in percentiles}
        
        final_values = paths[:, -1]
        
        return {
            "percentile_paths": percentile_paths,
            "mean_path": np.mean(paths, axis=0).tolist(),
            "statistics": {
                "mean_final": float(np.mean(final_values)),
                "median_final": float(np.median(final_values)),
                "std_final": float(np.std(final_values)),
                "min_final": float(np.min(final_values)),
                "max_final": float(np.max(final_values)),
                "var_95": float(np.percentile(final_values, 5)),
                "cvar_95": float(np.mean(final_values[final_values <= np.percentile(final_values, 5)])),
                "sharpe_ratio": float(mu / sigma) if sigma > 0 else 0,
                "annual_return": float(mu),
                "annual_volatility": float(sigma)
            },
            "num_simulations": num_sims,
            "time_horizon": num_steps
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
