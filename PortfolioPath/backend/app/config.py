"""
PortfolioPath Backend Configuration
===================================
Loads environment variables and provides typed configuration.
"""

from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True
    environment: str = "development"
    
    # Database
    database_url: str = "sqlite+aiosqlite:///./portfoliopath.db"
    
    # JWT Authentication
    secret_key: str = "change-this-in-production-use-secrets-module"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours
    
    # API Keys (optional)
    alpha_vantage_api_key: str = ""
    finnhub_api_key: str = ""
    polygon_api_key: str = ""
    
    # Redis (optional)
    redis_url: str = ""
    
    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:5174,http://localhost:3000"
    
    # Rate Limiting
    rate_limit_per_minute: int = 60
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
