from typing import List, Optional
from datetime import datetime
import uuid
from pydantic import BaseModel, Field

class SpaceResponse(BaseModel):
    id: uuid.UUID = Field(..., description="Unique identifier (UUID) of the space.")
    name: str = Field(..., min_length=1, max_length=100, description="Name of the space, must be between 1 and 100 characters.")
    # user_id: uuid.UUID TODO to be deleted later
    created_at: Optional[datetime] = Field(None, description="Timestamp when the space was created, in ISO 8601 format.")
    updated_at: Optional[datetime] = Field(None, description="Timestamp when the space was last updated, in ISO 8601 format.")
    class Config:
        from_attributes = True
        
class CreateSpaceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="The name of the space to create, between 1 and 100 characters.")
    class Config:
        json_schema_extra = {
            "example": {
                "name": "My New Space"
            }
        }

class GetSpacesRequest(BaseModel):
    limit: int = Field(10, ge=1, le=100, description="Number of spaces to return per page, between 1 and 100.")
    offset: int = Field(0, ge=0, description="Number of spaces to skip before starting the page, non-negative.")


class PaginationMetadata(BaseModel):
    limit: int = Field(..., ge=1, le=100, description="Number of spaces returned in the current page, between 1 and 100.")
    offset: int = Field(..., ge=0, description="Number of spaces skipped before the current page, non-negative.")
    total_count: int = Field(..., ge=0, description="Total number of spaces available for the user.")
        

class GetSpacesResponseWrapper(BaseModel):
    spaces: List[SpaceResponse] = Field(..., max_items=100, description="List of spaces, up to 100 items per page.")
    pagination: PaginationMetadata = Field(..., description="Pagination metadata including limit, offset, and total count.")

class UpdateSpaceRequest(BaseModel):
        name: str = Field(..., min_length=1, max_length=100, description="New name for the space, between 1 and 100 characters.")