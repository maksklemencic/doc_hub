from pydantic import BaseModel, Field, Optional
from datetime import datetime
import uuid

class CreateUserRequest(BaseModel):
    email: str = Field(...,min_length=1,max_length=254,description="The email address of the user.")
    first_name: str = Field(...,min_length=1, max_length=50, description="The first name of the user.")
    last_name: str = Field(...,min_length=1, max_length=100, description="The last name of the user.")
    
    
class UserResponse(BaseModel):
    id: uuid.UUID = Field(..., description="Unique identifier (UUID) of the user.")
    email: str = Field(..., min_length=1, max_length=254, description="The email address of the user.")
    first_name: str = Field(..., min_length=1, max_length=50, description="The first name of the user.")
    last_name: str = Field(..., min_length=1, max_length=100, description="The last name of the user.")
    created_at: Optional[datetime] = Field(None, description="Timestamp when the user was created, in ISO 8601 format.")
    
    class Config:
        from_attributes = True