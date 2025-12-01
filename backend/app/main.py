"""Main FastAPI application."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import create_tables

# Import routers
from app.api.stocks import router as stocks_router
from app.api.simulation import router as simulation_router
from app.api.auth import router as auth_router
from app.api.portfolios import router as portfolios_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print("🚀 Starting PortfolioPath API...")
    await create_tables()
    print("✅ Database tables created")
    yield
    # Shutdown
    print("👋 Shutting down PortfolioPath API...")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="""
    PortfolioPath API - Monte Carlo Portfolio Simulation Backend
    
    ## Features
    - 📈 Real-time stock data via yfinance
    - 🎲 Monte Carlo simulation with advanced models
    - 🔐 JWT Authentication
    - 💼 Portfolio management
    - 📊 Risk analysis and metrics
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(stocks_router)
app.include_router(simulation_router)
app.include_router(auth_router)
app.include_router(portfolios_router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
