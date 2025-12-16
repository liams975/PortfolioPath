# PortfolioPath Backend

FastAPI backend for the PortfolioPath Monte Carlo portfolio simulator.

## Features

- 📈 **Real-time Stock Data** - Live quotes and historical data via yfinance
- 🎲 **Monte Carlo Simulation** - High-performance NumPy-powered simulation engine
- 🔐 **JWT Authentication** - Secure user authentication with access/refresh tokens
- 💼 **Portfolio Management** - CRUD operations for saving portfolios
- 📊 **Risk Analytics** - VaR, Expected Shortfall, Sharpe Ratio, Max Drawdown
- 🎯 **Efficient Frontier** - Portfolio optimization analysis

## Quick Start

### 1. Create Virtual Environment

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

Copy the example environment file and update values:

```bash
cp .env.example .env
```

### 4. Run the Server

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

## API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Stocks
- `GET /api/stocks/quote/{ticker}` - Get stock quote
- `POST /api/stocks/batch` - Get multiple quotes
- `GET /api/stocks/historical/{ticker}` - Get historical data
- `GET /api/stocks/validate/{ticker}` - Validate ticker
- `GET /api/stocks/search?q=` - Search tickers
- `POST /api/stocks/correlation` - Get correlation matrix

### Simulation
- `POST /api/simulation/run` - Run Monte Carlo simulation
- `POST /api/simulation/compare` - Compare two portfolios
- `POST /api/simulation/efficient-frontier` - Generate efficient frontier
- `POST /api/simulation/goal-probability` - Calculate goal probability

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get tokens
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update profile
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/logout` - Logout

### Portfolios (Authenticated)
- `GET /api/portfolios` - List user portfolios
- `POST /api/portfolios` - Create portfolio
- `GET /api/portfolios/{id}` - Get portfolio
- `PUT /api/portfolios/{id}` - Update portfolio
- `DELETE /api/portfolios/{id}` - Delete portfolio
- `POST /api/portfolios/{id}/duplicate` - Duplicate portfolio

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Settings from environment
│   ├── database.py          # SQLAlchemy async setup
│   ├── api/
│   │   ├── __init__.py
│   │   ├── stocks.py        # Stock data endpoints
│   │   ├── simulation.py    # Simulation endpoints
│   │   ├── auth.py          # Authentication endpoints
│   │   └── portfolios.py    # Portfolio CRUD endpoints
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py          # User model
│   │   └── portfolio.py     # Portfolio models
│   └── services/
│       ├── __init__.py
│       ├── stock_service.py  # yfinance integration
│       ├── monte_carlo.py    # Simulation engine
│       └── auth_service.py   # JWT & password handling
├── .env                      # Environment variables
├── .env.example             # Example environment file
├── requirements.txt         # Python dependencies
└── README.md               # This file
```

## Simulation Example

```python
import requests

response = requests.post("http://localhost:8000/api/simulation/run", json={
    "holdings": [
        {"ticker": "AAPL", "allocation": 40},
        {"ticker": "MSFT", "allocation": 30},
        {"ticker": "BND", "allocation": 30}
    ],
    "initial_investment": 10000,
    "monthly_contribution": 500,
    "time_horizon": 10,
    "num_simulations": 1000
})

results = response.json()
print(f"Expected final value: ${results['final_values']['mean']:,.0f}")
print(f"Probability of profit: {results['risk_metrics']['probability_profit']:.1%}")
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | SQLite |
| `SECRET_KEY` | JWT signing key | (required) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiry | 30 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token expiry | 7 |
| `CORS_ORIGINS` | Allowed origins | localhost |
| `DEBUG` | Enable debug mode | false |

## Production Deployment

For production:

1. Use PostgreSQL instead of SQLite:
   ```
   DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/portfoliopath
   ```

2. Set a strong `SECRET_KEY`

3. Configure proper `CORS_ORIGINS`

4. Use gunicorn with uvicorn workers:
   ```bash
   gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
   ```
