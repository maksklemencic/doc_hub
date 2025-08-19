from fastapi import APIRouter, Depends, HTTPException, Query, status
import uuid

from backend.app.services import db_handler
from ..models.spaces import *


router = APIRouter()


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


@router.post("/", response_model=SpaceResponse)
def create_space(
    request: CreateSpaceRequest,
    current_user_id: uuid.UUID = Depends(get_current_user_id_from_query)  # Placeholder for user_id dependency
):
    try:
        db_space = db_handler.create_space(current_user_id, request.name)
        return db_space
    except db_handler.ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except db_handler.DatabaseError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except db_handler.ServiceError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=e.message)


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
    except db_handler.DatabaseError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except db_handler.ServiceError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=e.message)


@router.patch("/{space_id}", response_model=SpaceResponse)
def update_space(
    request: UpdateSpaceRequest, 
    space_id: uuid.UUID,
    current_user_id: uuid.UUID = Depends(get_current_user_id_from_query)  # Placeholder for user_id dependency
):
    try:
        space = db_handler.update_space(current_user_id, space_id, request.name)
        return space
    except db_handler.NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except db_handler.PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except db_handler.ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except db_handler.DatabaseError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except db_handler.ServiceError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=e.message)

@router.delete("/{space_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_space(
    space_id: uuid.UUID,
    current_user_id: uuid.UUID = Depends(get_current_user_id_from_query)  # Placeholder for user_id dependency
):
    try:
        db_handler.delete_space(current_user_id, space_id)
    except db_handler.NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except db_handler.PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except db_handler.ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except db_handler.DatabaseError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except db_handler.ServiceError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=e.message)