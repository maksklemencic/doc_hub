import os
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class OAuthSettings(BaseSettings):
    """OAuth configuration settings."""
    
    # Google OAuth settings
    GOOGLE_CLIENT_ID: str = Field(..., env="GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: str = Field(..., env="GOOGLE_CLIENT_SECRET")
    GOOGLE_REDIRECT_URI: str = Field(..., env="GOOGLE_REDIRECT_URI")
    
    # JWT settings
    JWT_SECRET_KEY: str = Field(..., env="JWT_SECRET_KEY")
    JWT_ALGORITHM: str = Field(default="HS256", env="JWT_ALGORITHM")
    JWT_EXPIRE_MINUTES: int = Field(default=60 * 24 * 7, env="JWT_EXPIRE_MINUTES")  # 7 days
    
    # OAuth URLs
    GOOGLE_DISCOVERY_URL: str = "https://accounts.google.com/.well-known/openid-configuration"
    
    # Frontend settings
    FRONTEND_URL: str = Field(default="http://localhost:3000", env="FRONTEND_URL")
    
    class Config:
        env_file = ".env"


oauth_settings = OAuthSettings()