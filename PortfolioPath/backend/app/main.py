"""
PortfolioPath Backend - Main Application
========================================
FastAPI application setup with all routes and middleware.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.api import stocks, simulation, portfolios, auth
from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle events."""
    # Startup
    print("🚀 Starting PortfolioPath Backend...")
    await init_db()
    print("✅ Database initialized")
    yield
    # Shutdown
    print("👋 Shutting down PortfolioPath Backend...")


# Create FastAPI application
app = FastAPI(
    title="PortfolioPath API",
    description="""
    Monte Carlo Portfolio Simulation Engine
    
    ## Features
    - Real-time stock data
    - Advanced Monte Carlo simulations
    - Portfolio management
    - Risk analytics
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(stocks.router, prefix="/api/stocks", tags=["Stock Data"])
app.include_router(simulation.router, prefix="/api/simulation", tags=["Simulation"])
app.include_router(portfolios.router, prefix="/api/portfolios", tags=["Portfolios"])


@app.get("/", tags=["Health"])
async def root():
    """Root endpoint - API health check."""
    return {
        "status": "healthy",
        "service": "PortfolioPath API",
        "version": "1.0.0"
    }


@app.get("/api/health", tags=["Health"])
async def health_check():
    """Detailed health check endpoint."""
    return {
        "status": "healthy",
        "database": "connected",
        "environment": settings.environment
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )
