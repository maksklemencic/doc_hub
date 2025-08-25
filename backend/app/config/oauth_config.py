import os
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class OAuthSettings(BaseSettings):
    """OAuth configuration settings."""
    
    # Google OAuth settings
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str  
    GOOGLE_REDIRECT_URI: str
    
    # JWT settings
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # OAuth URLs
    GOOGLE_DISCOVERY_URL: str = "https://accounts.google.com/.well-known/openid-configuration"
    
    # Frontend settings
    FRONTEND_URL: str = "http://localhost:3000"
    
    model_config = SettingsConfigDict(env_file=".env")


oauth_settings = OAuthSettings()