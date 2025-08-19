from fastapi import APIRouter, Depends, HTTPException, Query, status
import pathlib
from typing import List, Optional, datetime
import uuid
from pydantic import BaseModel, Field
# import datetime

from backend.app.services import db_handler


router = APIRouter()

class SpaceResponse(BaseModel):
    id: uuid.UUID
    name: str = Field(..., min_length=1, max_length=100)
    # user_id: uuid.UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config:
        orm_mode = True
        

# TODO Placeholder for user_id dependency
def get_current_user_id_from_query(user_id: uuid.UUID = Query(...)) -> uuid.UUID:
    """
    Temporary dependency to get user_id from query parameters
    TODO: Replace with actual OAuth implementation
    """
    # Add any validation logic here if needed
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user_id


# TODO POST Space
class CreateSpaceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    
@router.post("/", response_model=SpaceResponse)
def create_space(
    request: CreateSpaceRequest,
    current_user_id: uuid.UUID = Depends(get_current_user_id_from_query)  # Placeholder for user_id dependency
):
    try:
        db_space = db_handler.create_space(current_user_id, request.name)
        return db_space
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# TODO GET Spaces
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
    
@router.get("/", response_model=GetSpacesResponseWrapper)
def get_spaces(
    request: GetSpacesQuery = Depends(),
    current_user_id: uuid.UUID = Depends(get_current_user_id_from_query)  # Placeholder for user_id dependency
):
    try:
        spaces, total_count = db_handler.get_paginated_spaces(user_id=current_user_id, limit=request.limit, offset=request.offset)
        return {
            "spaces": spaces,
            "pagination": {
                "limit": request.limit,
                "offset": request.offset,
                "total_count": total_count
            }
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


# TODO PATCH Space
class UpdateSpaceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

@router.patch("/{space_id}", response_model=SpaceResponse)
def update_space(
    request: UpdateSpaceRequest, 
    space_id: uuid.UUID,
    current_user_id: uuid.UUID = Depends(get_current_user_id_from_query)  # Placeholder for user_id dependency
):
    try:
        space = db_handler.update_space(current_user_id, space_id, request.name)
        if not space:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
        return space
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# TODO DELETE Space
@router.delete("/{space_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_space(
    space_id: uuid.UUID,
    current_user_id: uuid.UUID = Depends(get_current_user_id_from_query)  # Placeholder for user_id dependency
):
    try:
        db_handler.delete_space(current_user_id, space_id)
    except db_handler.SpaceNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    except db_handler.IntegrityViolationError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot delete space; it is referenced elsewhere")
    except db_handler.DatabaseUnavailableError:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error deleting space: {str(e)}")   