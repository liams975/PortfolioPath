"""Simulation usage tracking model."""
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class SimulationUsage(Base):
    """Track daily simulation usage per user."""
    
    __tablename__ = "simulation_usage"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    usage_date = Column(Date, default=date.today, nullable=False, index=True)
    simulation_count = Column(Integer, default=0, nullable=False)
    
    # Track when last simulation was run
    last_simulation_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship to user
    user = relationship("User", back_populates="simulation_usage")
    
    def __repr__(self):
        return f"<SimulationUsage(user_id={self.user_id}, date={self.usage_date}, count={self.simulation_count})>"
