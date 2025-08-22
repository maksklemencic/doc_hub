import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt

from ..config.oauth_config import oauth_settings
from ..errors.auth_errors import InvalidTokenError, TokenExpiredError, TokenGenerationError
from ..models.auth import TokenData

logger = logging.getLogger(__name__)


class JWTService:
    """Service for handling JWT tokens."""
    
    def __init__(self):
        self.secret_key = oauth_settings.JWT_SECRET_KEY
        self.algorithm = oauth_settings.JWT_ALGORITHM
        self.expire_minutes = oauth_settings.JWT_EXPIRE_MINUTES
    
    def create_access_token(self, user_id: uuid.UUID, email: str) -> str:
        """Create a JWT access token."""
        try:
            logger.debug(f"Creating JWT token for user {user_id}")
            
            expire = datetime.utcnow() + timedelta(minutes=self.expire_minutes)
            payload = {
                "user_id": str(user_id),
                "email": email,
                "exp": expire,
                "iat": datetime.utcnow(),
                "type": "access"
            }
            
            token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
            logger.info(f"Successfully created JWT token for user {user_id}")
            return token
            
        except Exception as e:
            logger.error(f"Failed to create JWT token for user {user_id}: {str(e)}")
            raise TokenGenerationError(f"Token generation failed: {str(e)}")
    
    def verify_token(self, token: str) -> TokenData:
        """Verify and decode a JWT token."""
        try:
            logger.debug("Verifying JWT token")
            
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            
            user_id_str = payload.get("user_id")
            email = payload.get("email")
            exp = payload.get("exp")
            
            if not user_id_str or not email or not exp:
                logger.warning("JWT token has invalid payload structure")
                raise InvalidTokenError("Invalid token payload")
            
            # Check if token is expired
            if datetime.utcnow() > datetime.fromtimestamp(exp):
                logger.warning("JWT token has expired")
                raise TokenExpiredError("Token has expired")
            
            token_data = TokenData(
                user_id=uuid.UUID(user_id_str),
                email=email,
                exp=datetime.fromtimestamp(exp)
            )
            
            logger.debug(f"Successfully verified JWT token for user {token_data.user_id}")
            return token_data
            
        except (TokenExpiredError, InvalidTokenError):
            # Re-raise our custom errors
            raise
        except JWTError as e:
            logger.warning(f"JWT verification failed: {str(e)}")
            if "expired" in str(e).lower():
                raise TokenExpiredError("Token has expired")
            else:
                raise InvalidTokenError("Invalid or malformed token")
        except ValueError as e:
            logger.warning(f"JWT token format error: {str(e)}")
            raise InvalidTokenError("Invalid token format")
        except Exception as e:
            logger.error(f"Unexpected error during JWT verification: {str(e)}")
            raise InvalidTokenError("Token verification failed")
    
    def get_token_expiry(self) -> int:
        """Get token expiry time in seconds."""
        return self.expire_minutes * 60


jwt_service = JWTService()