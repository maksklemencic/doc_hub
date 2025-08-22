"""Authentication and OAuth-related error classes."""


class AuthError(Exception):
    """Base exception for authentication errors."""
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class JWTError(AuthError):
    """Base exception for JWT-related errors."""
    pass


class TokenExpiredError(JWTError):
    """Raised when JWT token has expired."""
    def __init__(self, message: str = "Token has expired"):
        super().__init__(message)


class InvalidTokenError(JWTError):
    """Raised when JWT token is invalid or malformed."""
    def __init__(self, message: str = "Invalid token"):
        super().__init__(message)


class TokenGenerationError(JWTError):
    """Raised when JWT token generation fails."""
    def __init__(self, message: str = "Failed to generate token"):
        super().__init__(message)


class OAuthError(AuthError):
    """Base exception for OAuth-related errors."""
    pass


class OAuthProviderError(OAuthError):
    """Raised when OAuth provider is unavailable or returns an error."""
    def __init__(self, provider: str, message: str):
        self.provider = provider
        super().__init__(f"OAuth provider {provider} error: {message}")


class InvalidAuthorizationCodeError(OAuthError):
    """Raised when OAuth authorization code is invalid or expired."""
    def __init__(self, message: str = "Invalid or expired authorization code"):
        super().__init__(message)


class TokenExchangeError(OAuthError):
    """Raised when OAuth token exchange fails."""
    def __init__(self, message: str = "Failed to exchange authorization code for tokens"):
        super().__init__(message)


class UserInfoError(OAuthError):
    """Raised when fetching user information from OAuth provider fails."""
    def __init__(self, message: str = "Failed to retrieve user information"):
        super().__init__(message)


class OAuthConfigurationError(OAuthError):
    """Raised when OAuth configuration is invalid or missing."""
    def __init__(self, missing_config: str):
        self.missing_config = missing_config
        super().__init__(f"Missing or invalid OAuth configuration: {missing_config}")


class AuthenticationFailedError(AuthError):
    """Raised when user authentication fails for any reason."""
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message)