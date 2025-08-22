import logging
from typing import Optional

from fastapi import Request
from fastapi.security.utils import get_authorization_scheme_param
from starlette.middleware.base import BaseHTTPMiddleware

from ..errors.auth_errors import InvalidTokenError, TokenExpiredError
from ..services.jwt_service import jwt_service

logger = logging.getLogger(__name__)


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware to handle JWT token validation and user context.
    
    This middleware automatically validates JWT tokens and adds user information
    to the request state for use in route handlers.
    """
    
    def __init__(self, app, exclude_paths: Optional[list] = None):
        super().__init__(app)
        # Paths that don't require authentication
        self.exclude_paths = exclude_paths or [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/auth/login",
            "/auth/callback",
            "/auth/health",
            "/health"
        ]
    
    async def dispatch(self, request: Request, call_next):
        """Process the request and validate JWT token if present."""
        
        # Skip authentication for excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        # Extract token from Authorization header
        authorization = request.headers.get("Authorization")
        scheme, token = get_authorization_scheme_param(authorization)
        
        # Initialize request state
        request.state.user_id = None
        request.state.user_email = None
        request.state.is_authenticated = False
        
        if authorization and scheme.lower() == "bearer" and token:
            try:
                # Validate token
                token_data = jwt_service.verify_token(token)
                
                # Add user information to request state
                request.state.user_id = token_data.user_id
                request.state.user_email = token_data.email
                request.state.is_authenticated = True
                
                logger.debug(f"Successfully authenticated user {token_data.user_id} for {request.url.path}")
                
            except TokenExpiredError as e:
                logger.debug(f"Expired token for {request.url.path}: {e.message}")
                # Don't raise the exception here - let the dependency handle it
                # This allows for optional authentication
                pass
            except InvalidTokenError as e:
                logger.debug(f"Invalid token for {request.url.path}: {e.message}")
                # Don't raise the exception here - let the dependency handle it
                pass
            except Exception as e:
                logger.warning(f"Unexpected error during token validation for {request.url.path}: {str(e)}")
                # Don't raise - allow request to continue without authentication
                pass
        
        response = await call_next(request)
        return response


def get_user_from_request(request: Request) -> Optional[str]:
    """
    Helper function to get user ID from request state.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Optional[str]: User ID if authenticated, None otherwise
    """
    return getattr(request.state, 'user_id', None)


def is_authenticated(request: Request) -> bool:
    """
    Helper function to check if request is authenticated.
    
    Args:
        request: FastAPI request object
        
    Returns:
        bool: True if authenticated, False otherwise
    """
    return getattr(request.state, 'is_authenticated', False)