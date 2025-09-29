"""
Groq LLM service implementation with rate limiting.

This module provides Groq-specific implementation of the LLM service interface
with built-in rate limiting and fallback mechanisms.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import AsyncGenerator, Dict, Any, Optional

import httpx
from groq import AsyncGroq

from .llm_service import LLMService, LLMProvider
from ..errors.llm_errors import (
    LLMConnectionError, LLMRequestError, LLMResponseError, RateLimitExceeded
)

logger = logging.getLogger(__name__)




class GroqRateLimiter:
    """Rate limiter for Groq API requests with dynamic limit detection."""

    def __init__(self):
        # Dynamic rate limits - will be updated from API responses
        self.requests_per_minute = 30  # Default fallback
        self.requests_per_day = 1000   # Default fallback
        self.tokens_per_minute = 30000  # Default fallback

        # Current usage tracking
        self.minute_requests = []
        self.day_requests = []
        self.minute_tokens = []

        # Track when limits reset
        self.requests_reset_time = None
        self.tokens_reset_time = None

        # Lock for thread safety
        self._lock = asyncio.Lock()

    async def can_make_request(self) -> tuple[bool, Optional[int]]:
        """
        Check if a request can be made within rate limits.

        Returns:
            Tuple of (can_make_request, retry_after_seconds)
        """
        async with self._lock:
            now = datetime.now(timezone.utc)

            # Clean old requests and tokens
            minute_ago = now - timedelta(minutes=1)
            day_ago = now - timedelta(days=1)

            self.minute_requests = [
                req_time for req_time in self.minute_requests if req_time > minute_ago
            ]
            self.day_requests = [
                req_time for req_time in self.day_requests if req_time > day_ago
            ]
            self.minute_tokens = [
                token_time for token_time in self.minute_tokens
                if token_time > minute_ago
            ]

            # Check if we're within reset times
            if self.requests_reset_time and now < self.requests_reset_time:
                retry_after = int((self.requests_reset_time - now).total_seconds())
                return False, retry_after

            if self.tokens_reset_time and now < self.tokens_reset_time:
                retry_after = int((self.tokens_reset_time - now).total_seconds())
                return False, retry_after

            # Check minute request limit
            if len(self.minute_requests) >= self.requests_per_minute:
                oldest_request = min(self.minute_requests)
                retry_after = int(
                    (oldest_request + timedelta(minutes=1) - now).total_seconds()
                )
                return False, retry_after

            # Check day request limit
            if len(self.day_requests) >= self.requests_per_day:
                oldest_request = min(self.day_requests)
                retry_after = int(
                    (oldest_request + timedelta(days=1) - now).total_seconds()
                )
                return False, retry_after

            return True, None

    async def record_request(self):
        """Record a successful request."""
        async with self._lock:
            now = datetime.now(timezone.utc)
            self.minute_requests.append(now)
            self.day_requests.append(now)

    async def update_limits_from_headers(self, headers: Dict[str, str]):
        """Update rate limits from API response headers."""
        async with self._lock:
            now = datetime.now(timezone.utc)

            # Parse request rate limits
            if 'x-ratelimit-limit-requests' in headers:
                self.requests_per_minute = int(headers['x-ratelimit-limit-requests'])

            if 'x-ratelimit-remaining-requests' in headers:
                remaining = int(headers['x-ratelimit-remaining-requests'])
                used = self.requests_per_minute - remaining
                # Adjust current tracking based on remaining count
                if used < len(self.minute_requests):
                    self.minute_requests = (
                        self.minute_requests[-used:] if used > 0 else []
                    )

            if 'x-ratelimit-reset-requests' in headers:
                reset_timestamp = headers['x-ratelimit-reset-requests']
                if reset_timestamp.isdigit():
                    # Unix timestamp
                    self.requests_reset_time = datetime.fromtimestamp(
                        int(reset_timestamp), timezone.utc
                    )
                else:
                    # ISO format or relative time
                    try:
                        self.requests_reset_time = datetime.fromisoformat(
                            reset_timestamp.replace('Z', '+00:00')
                        )
                    except ValueError:
                        # Fallback: assume 1 minute from now
                        self.requests_reset_time = now + timedelta(minutes=1)

            # Parse token rate limits
            if 'x-ratelimit-limit-tokens' in headers:
                self.tokens_per_minute = int(headers['x-ratelimit-limit-tokens'])

            if 'x-ratelimit-reset-tokens' in headers:
                reset_timestamp = headers['x-ratelimit-reset-tokens']
                if reset_timestamp.isdigit():
                    self.tokens_reset_time = datetime.fromtimestamp(
                        int(reset_timestamp), timezone.utc
                    )
                else:
                    try:
                        self.tokens_reset_time = datetime.fromisoformat(
                            reset_timestamp.replace('Z', '+00:00')
                        )
                    except ValueError:
                        self.tokens_reset_time = now + timedelta(minutes=1)

    def get_usage_info(self) -> Dict[str, Any]:
        """Get current usage information."""
        now = datetime.now(timezone.utc)
        return {
            "requests_per_minute_limit": self.requests_per_minute,
            "requests_per_day_limit": self.requests_per_day,
            "tokens_per_minute_limit": self.tokens_per_minute,
            "current_minute_requests": len(self.minute_requests),
            "current_day_requests": len(self.day_requests),
            "current_minute_tokens": len(self.minute_tokens),
            "requests_remaining": self.requests_per_minute - len(self.minute_requests),
            "day_remaining": self.requests_per_day - len(self.day_requests),
            "requests_reset_time": (
                self.requests_reset_time.isoformat()
                if self.requests_reset_time else None
            ),
            "tokens_reset_time": (
                self.tokens_reset_time.isoformat()
                if self.tokens_reset_time else None
            ),
            "rate_limits_dynamic": True
        }


class GroqService(LLMService):
    """Groq LLM service implementation with rate limiting."""

    def __init__(self, model_name: str, api_key: str | None = None, **kwargs):
        super().__init__(LLMProvider.GROQ, model_name)

        # Configuration
        resolved_api_key = api_key or os.getenv("GROQ_API_KEY")
        if not resolved_api_key:
            raise ValueError("GROQ_API_KEY is required")
        self.api_key = resolved_api_key

        self.client = AsyncGroq(api_key=self.api_key)
        self.timeout = kwargs.get("timeout", 30.0)

        # Rate limiting with dynamic detection
        self.rate_limiter = GroqRateLimiter()

        # No fallback needed - Groq is the only provider


    async def generate_response(
        self,
        prompt: str,
        stream: bool = False,
        **kwargs
    ) -> str:
        """Generate response using Groq API with rate limiting."""
        if stream:
            # Collect streaming response
            response_parts = []
            async for chunk in self.generate_streaming_response(prompt, **kwargs):
                response_parts.append(chunk)
            return "".join(response_parts)

        # Check rate limits
        can_request, retry_after = await self.rate_limiter.can_make_request()
        if not can_request:
            self.logger.warning(f"Groq rate limit exceeded, retry after {retry_after}s")
            raise RateLimitExceeded(
                "groq",
                f"Rate limit exceeded. Retry after {retry_after} seconds.",
                retry_after
            )

        try:
            # Make Groq API request
            response = await self.client.chat.completions.create(
                messages=[
                    {"role": "user", "content": prompt}
                ],
                model=self.model_name,
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 4000),
                **{k: v for k, v in kwargs.items()
                   if k not in ["temperature", "max_tokens"]}
            )

            # Update rate limits from response headers if available
            if (hasattr(response, '_raw_response') and
                    hasattr(response._raw_response, 'headers')):
                headers = dict(response._raw_response.headers)
                await self.rate_limiter.update_limits_from_headers(headers)

            # Record successful request
            await self.rate_limiter.record_request()

            generated_text = response.choices[0].message.content.strip()
            if not generated_text:
                raise LLMResponseError("groq", "Empty response from Groq")

            self.logger.debug(
                f"Generated Groq response: {len(generated_text)} characters"
            )
            return generated_text

        except RateLimitExceeded:
            raise
        except Exception as e:
            self.logger.error(f"Groq request failed: {str(e)}")
            raise LLMRequestError("groq", str(e))

    async def generate_streaming_response(
        self,
        prompt: str,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """Generate streaming response using Groq API."""
        # Check rate limits
        can_request, retry_after = await self.rate_limiter.can_make_request()
        if not can_request:
            self.logger.warning(
                f"Groq rate limit exceeded for streaming, retry after {retry_after}s"
            )
            raise RateLimitExceeded(
                "groq",
                f"Rate limit exceeded. Retry after {retry_after} seconds.",
                retry_after
            )

        try:
            # Make streaming Groq API request
            stream = await self.client.chat.completions.create(
                messages=[
                    {"role": "user", "content": prompt}
                ],
                model=self.model_name,
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 4000),
                stream=True,
                **{k: v for k, v in kwargs.items()
                   if k not in ["temperature", "max_tokens", "stream"]}
            )

            # Record successful request
            await self.rate_limiter.record_request()

            # Track if we've updated rate limits from headers
            headers_updated = False

            async for chunk in stream:
                # Update rate limits from first chunk headers if available
                if (not headers_updated and hasattr(chunk, '_raw_response') and
                        hasattr(chunk._raw_response, 'headers')):
                    headers = dict(chunk._raw_response.headers)
                    await self.rate_limiter.update_limits_from_headers(headers)
                    headers_updated = True

                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

            self.logger.debug("Groq streaming response completed")

        except RateLimitExceeded:
            raise
        except Exception as e:
            self.logger.error(f"Groq streaming failed: {str(e)}")
            raise LLMRequestError("groq", f"Streaming failed: {str(e)}")

    async def health_check(self) -> Dict[str, Any]:
        """Check Groq service health."""
        try:
            # Simple health check - try to list models
            models = await self.client.models.list()

            available_models = [model.id for model in models.data]
            model_available = self.model_name in available_models

            return {
                "status": "healthy",
                "provider": self.provider.value,
                "model_name": self.model_name,
                "model_available": model_available,
                "available_models": available_models,
                "rate_limit_info": self.rate_limiter.get_usage_info()
            }

        except Exception as e:
            return {
                "status": "unhealthy",
                "provider": self.provider.value,
                "error": str(e),
                "rate_limit_info": self.rate_limiter.get_usage_info()
            }

    def get_model_info(self) -> Dict[str, Any]:
        """Get Groq model information."""
        return {
            "provider": self.provider.value,
            "model_name": self.model_name,
            "supports_streaming": True,
            "timeout": self.timeout,
            "rate_limiting": True,
            "rate_limit_info": self.rate_limiter.get_usage_info()
        }

    def get_rate_limit_info(self) -> Dict[str, Any]:
        """Get current rate limit information."""
        return self.rate_limiter.get_usage_info()