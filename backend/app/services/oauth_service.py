import logging
import uuid
from typing import Optional, Tuple
from urllib.parse import urlencode

import httpx
from authlib.integrations.httpx_client import AsyncOAuth2Client

from ..config.oauth_config import oauth_settings
from ..errors.auth_errors import (
    AuthenticationFailedError,
    InvalidAuthorizationCodeError,
    OAuthConfigurationError,
    OAuthProviderError,
    TokenExchangeError,
    UserInfoError
)
from ..errors.database_errors import DatabaseError
from ..models.auth import AuthTokenResponse, GoogleUserInfo, UserProfile
from ..services import db_handler
from ..services.jwt_service import jwt_service

logger = logging.getLogger(__name__)


class OAuthService:
    """Service for handling OAuth authentication."""
    
    def __init__(self):
        self.google_client_id = oauth_settings.GOOGLE_CLIENT_ID
        self.google_client_secret = oauth_settings.GOOGLE_CLIENT_SECRET
        self.google_redirect_uri = oauth_settings.GOOGLE_REDIRECT_URI
        self.google_discovery_url = oauth_settings.GOOGLE_DISCOVERY_URL
        self.frontend_url = oauth_settings.FRONTEND_URL
    
    async def get_google_provider_cfg(self) -> dict:
        """Get Google's OAuth2 configuration."""
        try:
            logger.debug(f"Fetching Google OAuth configuration from {self.google_discovery_url}")
            
            async with httpx.AsyncClient() as client:
                response = await client.get(self.google_discovery_url)
                response.raise_for_status()
                config = response.json()
                
            logger.debug("Successfully fetched Google OAuth configuration")
            return config
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching Google provider configuration: {e.response.status_code} {e.response.text}")
            raise OAuthProviderError("google", f"Provider configuration unavailable: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"Network error fetching Google provider configuration: {str(e)}")
            raise OAuthProviderError("google", "Provider configuration service unavailable")
        except Exception as e:
            logger.error(f"Unexpected error fetching Google provider configuration: {str(e)}")
            raise OAuthProviderError("google", "Provider configuration service error")
    
    async def get_authorization_url(self) -> str:
        """Generate Google OAuth authorization URL."""
        try:
            logger.debug("Generating Google OAuth authorization URL")
            
            if not self.google_client_id or not self.google_redirect_uri:
                logger.error("Missing required OAuth configuration")
                raise OAuthConfigurationError("GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI")
            
            provider_cfg = await self.get_google_provider_cfg()
            authorization_endpoint = provider_cfg.get("authorization_endpoint")
            
            if not authorization_endpoint:
                logger.error("Missing authorization_endpoint in Google provider configuration")
                raise OAuthProviderError("google", "Invalid provider configuration")
            
            params = {
                "client_id": self.google_client_id,
                "redirect_uri": self.google_redirect_uri,
                "scope": "openid email profile",
                "response_type": "code",
                "access_type": "offline",
                "prompt": "consent"
            }
            
            auth_url = f"{authorization_endpoint}?{urlencode(params)}"
            logger.info("Successfully generated Google OAuth authorization URL")
            return auth_url
            
        except (OAuthProviderError, OAuthConfigurationError):
            # Re-raise our custom errors
            raise
        except Exception as e:
            logger.error(f"Unexpected error generating authorization URL: {str(e)}")
            raise OAuthProviderError("google", "Failed to generate authorization URL")
    
    async def exchange_code_for_tokens(self, code: str) -> dict:
        """Exchange authorization code for tokens."""
        try:
            logger.debug("Exchanging authorization code for tokens")
            
            if not code or not code.strip():
                logger.warning("Empty or invalid authorization code provided")
                raise InvalidAuthorizationCodeError("Empty authorization code")
            
            provider_cfg = await self.get_google_provider_cfg()
            token_endpoint = provider_cfg.get("token_endpoint")
            
            if not token_endpoint:
                logger.error("Missing token_endpoint in Google provider configuration")
                raise OAuthProviderError("google", "Invalid provider configuration")
            
            client = AsyncOAuth2Client(
                client_id=self.google_client_id,
                client_secret=self.google_client_secret
            )
            
            token = await client.fetch_token(
                token_endpoint,
                authorization_response=f"{self.google_redirect_uri}?code={code}",
                redirect_uri=self.google_redirect_uri
            )
            
            logger.info("Successfully exchanged authorization code for tokens")
            return token
            
        except InvalidAuthorizationCodeError:
            # Re-raise our custom error
            raise
        except Exception as e:
            logger.error(f"Failed to exchange authorization code for tokens: {str(e)}")
            if "invalid_grant" in str(e).lower() or "authorization code" in str(e).lower():
                raise InvalidAuthorizationCodeError("Invalid or expired authorization code")
            else:
                raise TokenExchangeError(f"Token exchange failed: {str(e)}")
    
    async def get_user_info(self, access_token: str) -> GoogleUserInfo:
        """Get user information from Google."""
        try:
            logger.debug("Fetching user information from Google")
            
            if not access_token or not access_token.strip():
                logger.warning("Empty or invalid access token provided")
                raise UserInfoError("Invalid access token")
            
            provider_cfg = await self.get_google_provider_cfg()
            userinfo_endpoint = provider_cfg.get("userinfo_endpoint")
            
            if not userinfo_endpoint:
                logger.error("Missing userinfo_endpoint in Google provider configuration")
                raise OAuthProviderError("google", "Invalid provider configuration")
            
            headers = {"Authorization": f"Bearer {access_token}"}
            
            async with httpx.AsyncClient() as client:
                response = await client.get(userinfo_endpoint, headers=headers)
                response.raise_for_status()
                user_data = response.json()
            
            user_info = GoogleUserInfo(**user_data)
            logger.info(f"Successfully retrieved user info for {user_info.email}")
            return user_info
            
        except UserInfoError:
            # Re-raise our custom error
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching user info: {e.response.status_code}")
            if e.response.status_code == 401:
                raise UserInfoError("Invalid or expired access token")
            else:
                raise UserInfoError(f"Failed to retrieve user information: {e.response.status_code}")
        except Exception as e:
            logger.error(f"Unexpected error fetching user info: {str(e)}")
            raise UserInfoError(f"Failed to retrieve user information: {str(e)}")
    
    async def authenticate_user(self, code: str) -> AuthTokenResponse:
        """Complete OAuth flow and authenticate user."""
        try:
            logger.info("Starting user authentication flow")
            
            # Exchange code for tokens
            tokens = await self.exchange_code_for_tokens(code)
            access_token = tokens.get("access_token")
            
            if not access_token:
                logger.error("No access token received from OAuth provider")
                raise TokenExchangeError("No access token received from OAuth provider")
            
            # Get user info from Google
            google_user = await self.get_user_info(access_token)
            
            # Find or create user in database
            user = await self.get_or_create_user(google_user)
            
            # Generate JWT token
            jwt_token = jwt_service.create_access_token(user.id, user.email)
            
            # Create response
            user_profile = UserProfile(
                id=user.id,
                email=user.email,
                name=user.name,
                picture=user.picture,
                created_at=user.created_at
            )
            
            auth_response = AuthTokenResponse(
                access_token=jwt_token,
                expires_in=jwt_service.get_token_expiry(),
                user=user_profile
            )
            
            logger.info(f"Successfully authenticated user {google_user.email}")
            return auth_response
            
        except (
            InvalidAuthorizationCodeError,
            TokenExchangeError,
            UserInfoError,
            OAuthProviderError,
            DatabaseError
        ):
            # Re-raise our custom errors
            raise
        except Exception as e:
            logger.error(f"Unexpected error during authentication: {str(e)}")
            raise AuthenticationFailedError(f"Authentication failed: {str(e)}")
    
    async def get_or_create_user(self, google_user: GoogleUserInfo):
        """Get existing user or create new one from Google user info."""
        try:
            logger.debug(f"Looking up user by email: {google_user.email}")
            
            # Try to find existing user by email
            existing_user = db_handler.get_user_by_email(google_user.email)
            
            if existing_user:
                logger.debug(f"Found existing user: {google_user.email}")
                
                # Update user info if needed
                if (existing_user.name != google_user.name or 
                    existing_user.picture != google_user.picture):
                    
                    logger.debug(f"Updating profile for existing user: {google_user.email}")
                    existing_user = db_handler.update_user_profile(
                        user_id=existing_user.id,
                        name=google_user.name,
                        picture=google_user.picture
                    )
                
                logger.info(f"Existing user authenticated: {google_user.email}")
                return existing_user
            else:
                logger.debug(f"Creating new user: {google_user.email}")
                
                # Create new user
                new_user = db_handler.create_user_from_oauth(
                    email=google_user.email,
                    name=google_user.name,
                    picture=google_user.picture,
                    google_id=google_user.sub
                )
                
                logger.info(f"New user created: {google_user.email}")
                return new_user
                
        except DatabaseError as e:
            logger.error(f"Database error during user creation/retrieval for {google_user.email}: {str(e)}")
            # Re-raise the DatabaseError (will be caught by authenticate_user)
            raise
        except Exception as e:
            logger.error(f"Unexpected error during user creation/retrieval for {google_user.email}: {str(e)}")
            raise AuthenticationFailedError(f"Failed to process user: {str(e)}")


oauth_service = OAuthService()