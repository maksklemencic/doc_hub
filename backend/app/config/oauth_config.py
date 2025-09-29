import os
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class OAuthSettings(BaseSettings):
    """OAuth configuration settings."""

    # Google OAuth settings - made optional with defaults
    GOOGLE_CLIENT_ID: str = "your_google_client_id"
    GOOGLE_CLIENT_SECRET: str = "your_google_client_secret"
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/google/callback"

    # JWT settings - made optional with default
    JWT_SECRET_KEY: str = "your_jwt_secret_key_please_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # OAuth URLs
    GOOGLE_DISCOVERY_URL: str = "https://accounts.google.com/.well-known/openid-configuration"

    # Frontend settings
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    def is_configured(self) -> bool:
        """Check if OAuth is properly configured with real values."""
        return (
            self.GOOGLE_CLIENT_ID != "your_google_client_id" and
            self.GOOGLE_CLIENT_SECRET != "your_google_client_secret" and
            self.JWT_SECRET_KEY != "your_jwt_secret_key_please_change_in_production"
        )


oauth_settings = OAuthSettings()