"""
LLM service error definitions.

This module defines custom exception classes for LLM service operations
including connection, request, response, and rate limiting errors.
"""

from typing import Optional


class LLMError(Exception):
    """Base exception for LLM service errors."""

    def __init__(self, message: str, provider: str = None):
        super().__init__(message)
        self.message = message
        self.provider = provider


class LLMConnectionError(LLMError):
    """Exception raised when LLM service connection fails."""

    def __init__(self, provider: str, message: str):
        super().__init__(f"Connection to {provider} failed: {message}", provider)


class LLMRequestError(LLMError):
    """Exception raised when LLM request fails."""

    def __init__(self, provider: str, message: str):
        super().__init__(f"{provider} request failed: {message}", provider)


class LLMResponseError(LLMError):
    """Exception raised when LLM response is invalid."""

    def __init__(self, provider: str, message: str):
        super().__init__(f"{provider} response error: {message}", provider)


class RateLimitExceeded(LLMError):
    """Exception raised when rate limits are exceeded."""

    def __init__(self, provider: str, message: str, retry_after: Optional[int] = None):
        super().__init__(f"{provider} rate limit exceeded: {message}", provider)
        self.retry_after = retry_after


class ModelNotFoundError(LLMError):
    """Exception raised when specified model is not available."""

    def __init__(self, provider: str, model_name: str):
        message = f"Model '{model_name}' not found or not available"
        super().__init__(message, provider)
        self.model_name = model_name


class TokenLimitExceededError(LLMError):
    """Exception raised when token limit is exceeded."""

    def __init__(self, provider: str, token_count: int, limit: int):
        message = f"Token limit exceeded: {token_count} > {limit}"
        super().__init__(message, provider)
        self.token_count = token_count
        self.limit = limit