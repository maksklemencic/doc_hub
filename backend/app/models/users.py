# User models for OAuth-based authentication system
# Note: User creation is handled automatically through OAuth login
# Only profile updates are exposed through PATCH /auth/me

from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class UpdateUserRequest(BaseModel):
    """Request model for updating user profile via PATCH /auth/me"""
    email: Optional[str] = Field(None, min_length=1, max_length=254, description="The email address of the user.")
    first_name: Optional[str] = Field(None, min_length=1, max_length=50, description="The first name of the user.")
    last_name: Optional[str] = Field(None, min_length=1, max_length=100, description="The last name of the user.")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "first_name": "John",
                "last_name": "Doe",
                "email": "john.doe@example.com"
            }
        }
    )