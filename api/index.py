"""
PortfolioPath API - Vercel Serverless Version
Uses in-memory storage (resets on cold start) for demo purposes.
For production, use a proper database like PostgreSQL on Supabase/Neon.
"""
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from jose import JWTError, jwt
import bcrypt
import yfinance as yf
import pandas as pd
import numpy as np
import json

# ============ Configuration ============
SECRET_KEY = "portfoliopath-secret-key-change-in-production-2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

app = FastAPI(
    title="PortfolioPath API",
    description="Monte Carlo Portfolio Simulation Backend",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)

# ============ In-Memory Storage ============
users_db: Dict[str, dict] = {}
portfolios_db: Dict[int, List[dict]] = {}  # user_id -> list of portfolios
user_id_counter = 1

# ============ Models ============
class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str]
    is_active: bool = True
    is_verified: bool = True
    created_at: str
    last_login: Optional[str] = None

class PortfolioCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    initial_investment: float = 10000
    monthly_contribution: float = 0
    time_horizon: int = 10
    holdings: List[dict] = []
    simulation_config: Optional[dict] = None

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

# ============ Auth Helpers ============
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: int, email: str, expires_delta: timedelta) -> str:
    expire = datetime.utcnow() + expires_delta
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    email = payload.get("email")
    if email not in users_db:
        raise HTTPException(status_code=401, detail="User not found")
    return users_db[email]

# ============ Health Endpoints ============
@app.get("/")
def root():
    return {"name": "PortfolioPath API", "version": "1.0.0", "status": "running"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/api/health")
def api_health():
    return {"status": "healthy", "database": "in-memory", "version": "1.0.0"}

# ============ Auth Endpoints ============
@app.post("/api/auth/register", response_model=TokenResponse)
def register(user: UserRegister):
    global user_id_counter
    if user.email in users_db:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_data = {
        "id": user_id_counter,
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "password_hash": hash_password(user.password),
        "created_at": datetime.utcnow().isoformat(),
        "is_active": True,
        "is_verified": True
    }
    users_db[user.email] = user_data
    portfolios_db[user_id_counter] = []
    user_id_counter += 1
    
    access_token = create_token(user_data["id"], user.email, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    refresh_token = create_token(user_data["id"], user.email, timedelta(days=7))
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@app.post("/api/auth/login", response_model=TokenResponse)
def login(credentials: UserLogin):
    user = users_db.get(credentials.email)
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_token(user["id"], credentials.email, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    refresh_token = create_token(user["id"], credentials.email, timedelta(days=7))
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        username=current_user["username"],
        full_name=current_user.get("full_name"),
        is_active=True,
        is_verified=True,
        created_at=current_user["created_at"]
    )

@app.post("/api/auth/logout")
def logout():
    return {"message": "Logged out successfully"}

# ============ Portfolio Endpoints ============
@app.get("/api/portfolios")
def list_portfolios(current_user: dict = Depends(get_current_user)):
    user_portfolios = portfolios_db.get(current_user["id"], [])
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "description": p.get("description", ""),
            "holdings_count": len(p.get("holdings", [])),
            "total_allocation": sum(h.get("allocation", 0) for h in p.get("holdings", [])),
            "created_at": p.get("created_at", "")
        }
        for p in user_portfolios
    ]

@app.post("/api/portfolios", status_code=201)
def create_portfolio(portfolio: PortfolioCreate, current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    if user_id not in portfolios_db:
        portfolios_db[user_id] = []
    
    portfolio_id = len(portfolios_db[user_id]) + 1
    portfolio_data = {
        "id": portfolio_id,
        "name": portfolio.name,
        "description": portfolio.description,
        "initial_investment": portfolio.initial_investment,
        "monthly_contribution": portfolio.monthly_contribution,
        "time_horizon": portfolio.time_horizon,
        "holdings": portfolio.holdings,
        "simulation_config": portfolio.simulation_config or {},
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    portfolios_db[user_id].append(portfolio_data)
    
    return {
        "id": portfolio_id,
        "name": portfolio.name,
        "description": portfolio.description,
        "initial_investment": portfolio.initial_investment,
        "monthly_contribution": portfolio.monthly_contribution,
        "time_horizon": portfolio.time_horizon,
        "simulation_config": portfolio.simulation_config,
        "holdings": portfolio.holdings,
        "total_allocation": sum(h.get("allocation", 0) for h in portfolio.holdings),
        "created_at": portfolio_data["created_at"],
        "updated_at": portfolio_data["updated_at"]
    }

@app.delete("/api/portfolios/{portfolio_id}", status_code=204)
def delete_portfolio(portfolio_id: int, current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    user_portfolios = portfolios_db.get(user_id, [])
    portfolios_db[user_id] = [p for p in user_portfolios if p["id"] != portfolio_id]
    return None

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
            "exchange": info.get("exchange", ""),
            "sector": info.get("sector", ""),
            "industry": info.get("industry", ""),
            "market_cap": info.get("marketCap"),
            "history": {
                "dates": hist.index.strftime("%Y-%m-%d").tolist(),
                "close": hist["Close"].tolist(),
                "volume": hist["Volume"].tolist()
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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

# ============ Simulation Endpoint ============
@app.post("/api/simulate")
def run_simulation(request: SimulationRequest):
    try:
        # Fetch historical data
        tickers = [t.upper() for t in request.tickers]
        data = {}
        
        for ticker in tickers:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="2y")
            if not hist.empty:
                data[ticker] = hist["Close"].pct_change().dropna()
        
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
            paths[:, t] += request.monthly_contribution * (t // 21)  # Monthly contribution
        
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
