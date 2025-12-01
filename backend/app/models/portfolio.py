"""Portfolio database models."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Portfolio(Base):
    """Portfolio model for storing user portfolios."""
    
    __tablename__ = "portfolios"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=True)
    
    # Owner relationship
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="portfolios")
    
    # Portfolio settings
    initial_investment = Column(Float, default=10000.0)
    monthly_contribution = Column(Float, default=0.0)
    time_horizon = Column(Integer, default=10)  # Years
    
    # Simulation settings (stored as JSON for flexibility)
    simulation_config = Column(JSON, nullable=True, default={
        "num_simulations": 1000,
        "include_dividends": True,
        "include_jump_diffusion": False,
        "rebalancing_frequency": "none"
    })
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Holdings relationship
    holdings = relationship("PortfolioHolding", back_populates="portfolio", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Portfolio(id={self.id}, name={self.name}, owner_id={self.owner_id})>"
    
    @property
    def total_allocation(self) -> float:
        """Calculate total allocation percentage from holdings."""
        return sum(h.allocation for h in self.holdings)
    
    def to_dict(self) -> dict:
        """Convert portfolio to dictionary for API responses."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "initial_investment": self.initial_investment,
            "monthly_contribution": self.monthly_contribution,
            "time_horizon": self.time_horizon,
            "simulation_config": self.simulation_config,
            "holdings": [h.to_dict() for h in self.holdings],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class PortfolioHolding(Base):
    """Individual holding within a portfolio."""
    
    __tablename__ = "portfolio_holdings"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Portfolio relationship
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    portfolio = relationship("Portfolio", back_populates="holdings")
    
    # Holding details
    ticker = Column(String(10), nullable=False)
    name = Column(String(255), nullable=True)
    allocation = Column(Float, nullable=False)  # Percentage (0-100)
    
    # Optional: track purchase info
    purchase_price = Column(Float, nullable=True)
    shares = Column(Float, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<PortfolioHolding(ticker={self.ticker}, allocation={self.allocation}%)>"
    
    def to_dict(self) -> dict:
        """Convert holding to dictionary for API responses."""
        return {
            "id": self.id,
            "ticker": self.ticker,
            "name": self.name,
            "allocation": self.allocation,
            "purchase_price": self.purchase_price,
            "shares": self.shares,
        }
