import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..errors.database_errors import ConflictError, DatabaseError, NotFoundError, PermissionError
from ..models.spaces import CreateSpaceRequest, GetSpacesRequest, GetSpacesResponseWrapper, SpaceResponse, UpdateSpaceRequest
from ..services import db_handler


router = APIRouter()
logger = logging.getLogger(__name__)

tags_metadata = [
    {
        "name": "spaces",
        "description": "Operations related to managing spaces, including creating, retrieving, updating, and deleting spaces."
    }
]


# TODO Placeholder for user_id dependency
def get_current_user_id_from_query(current_user_id: uuid.UUID = Query(...)) -> uuid.UUID:
    """
    Temporary dependency to get current_user_id from query parameters
    TODO: Replace with actual OAuth implementation
    """
    # Add any validation logic here if needed
    if not current_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return current_user_id


@router.post(
    "/", 
    response_model=SpaceResponse,
    tags=["spaces"],
    summary="Create a new space",
    description="Creates a new space with the provided name for the authenticated user.",
    response_description="The created space object with its ID, name, and timestamps.",
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {"description": "Space successfully created"},
        401: {"description": "Authentication required"},
        409: {"description": "Conflict; Space with the same name already exists"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
        503: {"description": "Database unavailable"}
    }
)
def create_space(
    request: CreateSpaceRequest,
    current_user_id: uuid.UUID = Depends(get_current_user_id_from_query)  # Placeholder for user_id dependency
):
    try:
        db_space = db_handler.create_space(current_user_id, request.name)
        return db_space
    except ConflictError as e:
        logger.error(f"Conflict creating space '{request.name}' for user {current_user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except DatabaseError as e:
        logger.error(f"Database error creating space '{request.name}' for user {current_user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected error creating space '{request.name}' for user {current_user_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")


@router.get(
    "/", 
    response_model=GetSpacesResponseWrapper,
    tags=["spaces"],
    summary="Retrieve paginated spaces",
    description="Fetches a paginated list of spaces for the authenticated user, with optional limit and offset parameters.",
    response_description="A list of spaces with pagination metadata (limit, offset, and total count).",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "List of spaces successfully retrieved"},
        401: {"description": "Authentication required"},
        500: {"description": "Internal server error"},
        503: {"description": "Database unavailable"}
    }
)
def get_spaces(
    request: GetSpacesRequest = Depends(),
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
    except DatabaseError as e:
        logger.error(f"Database error fetching spaces for user {current_user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected error fetching spaces for user {current_user_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")


@router.patch(
    "/{space_id}", 
    response_model=SpaceResponse,
    tags=["spaces"],
    summary="Update a space",
    description="Updates the name of an existing space identified by its UUID for the authenticated user.",
    response_description="The updated space object with its ID, name, and timestamps.",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Space successfully updated"},
        401: {"description": "Authentication required"},
        403: {"description": "Permission denied"},
        404: {"description": "Space not found"},
        500: {"description": "Internal server error"},
        503: {"description": "Database unavailable"}
    }
)
def update_space(
    request: UpdateSpaceRequest, 
    space_id: uuid.UUID,
    current_user_id: uuid.UUID = Depends(get_current_user_id_from_query)  # Placeholder for user_id dependency
):
    try:
        space = db_handler.update_space(current_user_id, space_id, request.name)
        return space
    except PermissionError as e:
        logger.warning(f"Permission denied for user {current_user_id} to update space {space_id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except NotFoundError as e:
        logger.warning(f"Space {space_id} not found for user {current_user_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except DatabaseError as e:
        logger.error(f"Database error updating space {space_id} for user {current_user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected error updating space {space_id} for user {current_user_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

@router.delete(
    "/{space_id}", 
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["spaces"],
    summary="Delete a space",
    description="Deletes a space identified by its UUID for the authenticated user.",
    response_description="No content returned on successful deletion.",
    responses={
        204: {"description": "Space successfully deleted"},
        401: {"description": "Authentication required"},
        403: {"description": "Permission denied"},
        404: {"description": "Space not found"},
        409: {"description": "Conflict, e.g., space cannot be deleted due to dependencies"},
        500: {"description": "Internal server error"},
        503: {"description": "Database unavailable"}
    }
)
def delete_space(
    space_id: uuid.UUID,
    current_user_id: uuid.UUID = Depends(get_current_user_id_from_query)  # Placeholder for user_id dependency
):
    try:
        db_handler.delete_space(current_user_id, space_id)
    except PermissionError as e:
        logger.warning(f"Permission denied for user {current_user_id} to delete space {space_id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except NotFoundError as e:
        logger.warning(f"Space {space_id} not found for user {current_user_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except ConflictError as e:
        logger.warning(f"Conflict deleting space {space_id} for user {current_user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except DatabaseError as e:
        logger.error(f"Database error deleting space {space_id} for user {current_user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected error deleting space {space_id} for user {current_user_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")