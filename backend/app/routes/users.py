from fastapi import APIRouter, Depends, HTTPException, Query, status
import uuid
import logging

from ..models.users import CreateUserRequest, UpdateUserRequest, UserResponse
from ..services import db_handler
from ..errors.db_errors import ServiceError, DatabaseError, NotFoundError, PermissionError, ConflictError


router = APIRouter()

logger = logging.getLogger(__name__)

tags_metadata = [
    {
        "name": "users",
        "description": "Operations related to managing users."
    }
]

# Placeholder for user_id dependency
def get_current_user_id_from_query(current_user_id: uuid.UUID = Query(...)) -> uuid.UUID:
    """
    Temporary dependency to get current_user_id from query parameters
    TODO: Replace with actual OAuth implementation
    """
    if not current_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return current_user_id


@router.post(
    "/",
    response_model=UserResponse,
    tags=["users"],
    summary="Create a new user",
    description="Creates a new user with the provided email, first name, and last name.",
    response_description="The created user object with its ID and details.",
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {"description": "User successfully created"},
        409: {"description": "Conflict; User with this email already exists"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
        503: {"description": "Database unavailable"}
    }
)
def create_user(
    request: CreateUserRequest,
):
    try:
        db_user = db_handler.create_user(
            email=request.email,
            first_name=request.first_name,
            last_name=request.last_name
        )
        return db_user
    except ConflictError as e:
        logger.error(f"Conflict creating user with email '{request.email}': {e.message}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except DatabaseError as e:
        logger.error(f"Database error creating user with email '{request.email}': {e.message}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected error creating user with email '{request.email}': {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")
    

@router.get(
    "/{user_id}",
    response_model=UserResponse,
    tags=["users"],
    summary="Get user by ID",
    description="Retrieves a user by their unique identifier (UUID).",
    response_description="The user object with its ID and details.",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "User successfully retrieved"},
        401: {"description": "Authentication required"},
        403: {"description": "Forbidden; You do not have permission to access this user"},
        404: {"description": "User not found"},
        500: {"description": "Internal server error"},
        503: {"description": "Database unavailable"}
    }
)
def get_user(
    user_id: uuid.UUID,
    current_user_id: uuid.UUID = Depends(get_current_user_id_from_query)
):
    try:
        user = db_handler.get_user_by_id(user_id, current_user_id)
        return user
    except PermissionError as e:
        logger.warning(f"Permission denied for user {current_user_id} to access user {user_id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except NotFoundError as e:
        logger.warning(f"User {user_id} not found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except DatabaseError as e:
        logger.error(f"Database error fetching user {user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected error fetching user {user_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    tags=["users"],
    summary="Update a user",
    description="Update user information. Users can only update their own profile.",
    response_description="The updated user object with its ID and details.",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "User successfully updated"},
        401: {"description": "Authentication required"},
        403: {"description": "Forbidden; You do not have permission to update this user"},
        404: {"description": "User not found"},
        409: {"description": "Conflict; User with this email already exists"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
        503: {"description": "Database unavailable"}
    }
)
def update_user(
    user_id: uuid.UUID,
    request: UpdateUserRequest,
    current_user_id: uuid.UUID = Depends(get_current_user_id_from_query)
):
    try:
        user = db_handler.update_user(
            user_id, current_user_id,
            email=request.email,
            first_name=request.first_name,
            last_name=request.last_name
        )
        return user
    except PermissionError as e:
        logger.warning(f"Permission denied for user {current_user_id} to update user {user_id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except NotFoundError as e:
        logger.warning(f"User {user_id} not found for update")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except ConflictError as e:
        logger.error(f"Conflict updating user {user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except DatabaseError as e:
        logger.error(f"Database error updating user {user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected error updating user {user_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["users"],
    summary="Delete a user",
    description="Deletes a user identified by their UUID.",
    response_description="No content returned on successful deletion.",
    responses={
        204: {"description": "User successfully deleted"},
        401: {"description": "Authentication required"},
        403: {"description": "Forbidden; You do not have permission to delete this user"},
        404: {"description": "User not found"},
        500: {"description": "Internal server error"},
        503: {"description": "Database unavailable"}
    }
)
def delete_user(
    user_id: uuid.UUID, 
    current_user_id: uuid.UUID = Depends(get_current_user_id_from_query)
):
    try:
        db_handler.delete_user(user_id, current_user_id)
    except PermissionError as e:
        logger.warning(f"Permission denied for user {current_user_id} to delete user {user_id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except NotFoundError as e:
        logger.warning(f"User {user_id} not found for deletion")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except DatabaseError as e:
        logger.error(f"Database error deleting user {user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected error deleting user {user_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")