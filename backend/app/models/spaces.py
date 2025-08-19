from typing import List, Optional, datetime
import uuid
from pydantic import BaseModel, Field

class SpaceResponse(BaseModel):
    id: uuid.UUID
    name: str = Field(..., min_length=1, max_length=100)
    # user_id: uuid.UUID TODO to be deleted later
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config:
        orm_mode = True
        
class CreateSpaceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    

class GetSpacesQuery(BaseModel):
    limit: int = Field(10, ge=1, le=100)
    offset: int = Field(0, ge=0)


class PaginationMetadata(BaseModel):
    limit: int = Field(..., ge=1, le=100)
    offset: int = Field(..., ge=0)
    total_count: int = Field(..., ge=0)
        

class GetSpacesResponseWrapper(BaseModel):
    spaces: List[SpaceResponse] = Field(..., max_items=100)
    pagination: PaginationMetadata
    

class UpdateSpaceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)