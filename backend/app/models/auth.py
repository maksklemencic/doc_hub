import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class TokenData(BaseModel):
    """Token payload data."""
    user_id: uuid.UUID
    email: str
    exp: datetime


class GoogleUserInfo(BaseModel):
    """Google user information from OAuth."""
    sub: str = Field(..., description="Google user ID", alias="id")
    email: EmailStr = Field(..., description="User email address")
    email_verified: bool = Field(..., description="Whether email is verified", alias="verified_email")
    name: str = Field(..., description="Full name")
    given_name: str = Field(..., description="First name")
    family_name: str = Field(..., description="Last name")
    picture: Optional[str] = Field(None, description="Profile picture URL")
    locale: Optional[str] = Field(None, description="User locale")
    
    class Config:
        populate_by_name = True


class AuthTokenResponse(BaseModel):
    """Authentication token response."""
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration time in seconds")
    user: "UserProfile" = Field(..., description="User profile information")


class UserProfile(BaseModel):
    """User profile information."""
    id: uuid.UUID = Field(..., description="User ID")
    email: EmailStr = Field(..., description="Email address")
    name: str = Field(..., description="Full name")
    picture: Optional[str] = Field(None, description="Profile picture URL")
    created_at: datetime = Field(..., description="Account creation time")


class LoginRequest(BaseModel):
    """OAuth login request."""
    provider: str = Field(default="google", description="OAuth provider")


class LogoutRequest(BaseModel):
    """Logout request."""
    token: str = Field(..., description="JWT token to invalidate")


# Update forward references
AuthTokenResponse.model_rebuild()