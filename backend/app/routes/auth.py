import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse

from ..config.oauth_config import oauth_settings
from ..dependencies.auth import get_current_user
from ..errors.auth_errors import (
    AuthError,
    AuthenticationFailedError,
    InvalidAuthorizationCodeError,
    InvalidTokenError,
    OAuthConfigurationError,
    OAuthProviderError,
    TokenExpiredError,
    TokenExchangeError,
    UserInfoError
)
from ..errors.database_errors import ConflictError, DatabaseError, NotFoundError
from ..models.auth import AuthTokenResponse, LoginRequest, UserProfile
from ..models.users import UpdateUserRequest
from ..services.oauth_service import oauth_service

logger = logging.getLogger(__name__)
router = APIRouter()

tags_metadata = [
    {
        "name": "auth",
        "description": "Authentication endpoints for OAuth login, logout, and user profile management."
    }
]

@router.get(
    "/login",
    tags=["auth"],
    summary="Initiate OAuth login",
    description="Redirects to Google OAuth authorization page to begin login process.",
    response_description="Redirect to Google OAuth authorization URL.",
    responses={
        302: {"description": "Redirect to Google OAuth"},
        503: {"description": "OAuth service unavailable"},
        500: {"description": "Internal server error"}
    }
)
async def login():
    try:
        logger.info("Initiating OAuth login flow")
        auth_url = await oauth_service.get_authorization_url()
        logger.info("Successfully generated OAuth authorization URL")
        return RedirectResponse(url=auth_url)
        
    except OAuthConfigurationError as e:
        logger.error(f"OAuth configuration error: {e.message}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OAuth service configuration error"
        )
    except OAuthProviderError as e:
        logger.error(f"OAuth provider error: {e.message}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OAuth service temporarily unavailable"
        )
    except Exception as e:
        logger.error(f"Unexpected error during login initiation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate login"
        )


@router.get(
    "/callback",
    response_model=AuthTokenResponse,
    tags=["auth"],
    summary="OAuth callback endpoint",
    description="Handles OAuth callback from Google and completes authentication process.",
    response_description="JWT access token and user profile information.",
    responses={
        200: {"description": "Authentication successful"},
        400: {"description": "Invalid authorization code"},
        500: {"description": "Authentication failed"},
        503: {"description": "Database unavailable"}
    }
)
async def oauth_callback(
    code: Optional[str] = Query(None, description="Authorization code from OAuth provider"),
    error: Optional[str] = Query(None, description="Error from OAuth provider")
):
    frontend_url = f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/auth/callback"
    
    if error:
        logger.warning(f"OAuth error received from provider: {error}")
        error_url = f"{frontend_url}?error=oauth_provider_error&error_description={error}"
        return RedirectResponse(url=error_url)
    
    if not code:
        logger.warning("OAuth callback received without authorization code")
        error_url = f"{frontend_url}?error=no_code&error_description=Authorization+code+not+provided"
        return RedirectResponse(url=error_url)
    
    try:
        logger.info("Processing OAuth callback with authorization code")
        
        # Complete OAuth flow
        auth_response = await oauth_service.authenticate_user(code)
        logger.info(f"User authentication completed successfully: {auth_response.user.email}")
        
        # Redirect to frontend with auth data as URL parameters
        redirect_url = f"{frontend_url}?access_token={auth_response.access_token}&expires_in={auth_response.expires_in}&user_id={auth_response.user.id}&user_email={auth_response.user.email}&user_name={auth_response.user.name}"
        
        logger.info(f"Redirecting user to frontend: {frontend_url}")
        return RedirectResponse(url=redirect_url)
        
    except InvalidAuthorizationCodeError as e:
        logger.warning(f"Invalid authorization code in OAuth callback: {e.message}")
        error_url = f"{frontend_url}?error=invalid_code&error_description=Invalid+or+expired+authorization+code"
        return RedirectResponse(url=error_url)
    except TokenExchangeError as e:
        logger.error(f"Token exchange failed in OAuth callback: {e.message}")
        error_url = f"{frontend_url}?error=token_exchange_failed&error_description=Failed+to+exchange+authorization+code+for+tokens"
        return RedirectResponse(url=error_url)
    except UserInfoError as e:
        logger.error(f"Failed to retrieve user info in OAuth callback: {e.message}")
        error_url = f"{frontend_url}?error=user_info_failed&error_description=Failed+to+retrieve+user+information"
        return RedirectResponse(url=error_url)
    except OAuthProviderError as e:
        logger.error(f"OAuth provider error in callback: {e.message}")
        error_url = f"{frontend_url}?error=oauth_provider_error&error_description=OAuth+service+temporarily+unavailable"
        return RedirectResponse(url=error_url)
    except DatabaseError as e:
        logger.error(f"Database error during OAuth authentication: {e.message}")
        error_url = f"{frontend_url}?error=database_error&error_description=Database+service+temporarily+unavailable"
        return RedirectResponse(url=error_url)
    except AuthenticationFailedError as e:
        logger.error(f"Authentication failed in OAuth callback: {e.message}")
        error_url = f"{frontend_url}?error=auth_failed&error_description=Authentication+failed"
        return RedirectResponse(url=error_url)
    except Exception as e:
        logger.error(f"Unexpected error in OAuth callback: {str(e)}")
        error_url = f"{frontend_url}?error=unexpected_error&error_description=Authentication+callback+failed"
        return RedirectResponse(url=error_url)


@router.post(
    "/logout",
    tags=["auth"],
    summary="Logout user",
    description="Logout the current authenticated user. Note: This is a placeholder for client-side token removal.",
    response_description="Logout confirmation message.",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Successfully logged out"},
        401: {"description": "Authentication required"}
    }
)
async def logout(current_user_id: str = Depends(get_current_user)):
    """
    Logout user (client should remove the token).
    
    Note: Since we're using stateless JWT tokens, logout is handled client-side
    by removing the token. In a production system, you might want to implement
    token blacklisting.
    """
    try:
        logger.info(f"User {current_user_id} initiated logout")
        return {"message": "Successfully logged out"}
        
    except (TokenExpiredError, InvalidTokenError) as e:
        logger.warning(f"Invalid token during logout: {e.message}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    except Exception as e:
        logger.error(f"Unexpected error during logout for user {current_user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed"
        )


@router.get(
    "/me",
    response_model=UserProfile,
    tags=["auth"],
    summary="Get current user profile",
    description="Retrieve the profile information of the currently authenticated user.",
    response_description="Current user's profile information.",
    responses={
        200: {"description": "User profile retrieved successfully"},
        401: {"description": "Authentication required"},
        404: {"description": "User not found"},
        503: {"description": "Database unavailable"}
    }
)
async def get_current_user_profile(current_user_id: str = Depends(get_current_user)):
    """Get current authenticated user's profile."""
    try:
        from ..services import db_handler
        
        logger.debug(f"Retrieving profile for user {current_user_id}")
        
        user = db_handler.get_user_by_id_simple(current_user_id)
        if not user:
            logger.warning(f"User {current_user_id} not found in database")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        profile = UserProfile(
            id=user.id,
            email=user.email,
            name=user.name,
            picture=user.picture,
            created_at=user.created_at
        )
        
        logger.info(f"Successfully retrieved profile for user {current_user_id}")
        return profile
        
    except HTTPException:
        raise
    except (TokenExpiredError, InvalidTokenError) as e:
        logger.warning(f"Invalid token for profile request: {e.message}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    except DatabaseError as e:
        logger.error(f"Database error retrieving profile for {current_user_id}: {e.message}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service temporarily unavailable"
        )
    except Exception as e:
        logger.error(f"Unexpected error retrieving profile for {current_user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user profile"
        )


@router.patch(
    "/me",
    response_model=UserProfile,
    tags=["auth"],
    summary="Update current user profile",
    description="Update the profile information of the currently authenticated user.",
    response_description="Updated user profile information.",
    responses={
        200: {"description": "User profile updated successfully"},
        401: {"description": "Authentication required"},
        404: {"description": "User not found"},
        409: {"description": "Conflict; User with this email already exists"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
        503: {"description": "Database unavailable"}
    }
)
async def update_current_user_profile(
    request: UpdateUserRequest,
    current_user_id: str = Depends(get_current_user)
):
    try:
        from ..services import db_handler
        from ..errors.database_errors import ConflictError, DatabaseError, NotFoundError
        
        logger.info(f"Updating profile for user {current_user_id}")
        
        # Update user profile
        updated_user = db_handler.update_user(
            user_id=current_user_id,
            current_user_id=current_user_id,  # Same user updating themselves
            email=request.email,
            first_name=request.first_name,
            last_name=request.last_name
        )
        
        # Also update the name field for consistency
        if request.first_name or request.last_name:
            full_name = f"{request.first_name or ''} {request.last_name or ''}".strip()
            if full_name:
                db_handler.update_user_profile(
                    user_id=current_user_id,
                    name=full_name
                )
                updated_user = db_handler.get_user_by_id_simple(current_user_id)
        
        return UserProfile(
            id=updated_user.id,
            email=updated_user.email,
            name=updated_user.name or f"{updated_user.first_name or ''} {updated_user.last_name or ''}".strip(),
            picture=updated_user.picture,
            created_at=updated_user.created_at
        )
        
    except ConflictError as e:
        logger.warning(f"Conflict updating profile for user {current_user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except NotFoundError as e:
        logger.warning(f"User {current_user_id} not found for profile update")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except DatabaseError as e:
        logger.error(f"Database error updating profile for user {current_user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update user profile for {current_user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user profile"
        )


# @router.get(
#     "/health",
#     tags=["auth"],
#     summary="Authentication service health check",
#     description="Check if the authentication service is operational.",
#     responses={
#         200: {"description": "Service is healthy"},
#         503: {"description": "Service unavailable"}
#     }
# )
# async def auth_health_check():
#     """Health check for authentication service."""
#     try:
#         logger.debug("Performing authentication service health check")
        
#         # Try to get Google provider configuration
#         await oauth_service.get_google_provider_cfg()
        
#         logger.info("Authentication service health check passed")
#         return {"status": "healthy", "service": "authentication"}
        
#     except OAuthProviderError as e:
#         logger.error(f"OAuth provider unavailable during health check: {e.message}")
#         raise HTTPException(
#             status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
#             detail="OAuth provider unavailable"
#         )
#     except Exception as e:
#         logger.error(f"Unexpected error during auth health check: {str(e)}")
#         raise HTTPException(
#             status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
#             detail="Authentication service unavailable"
#         )