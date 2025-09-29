"""
Abstract LLM service interface for easy switching between providers.

This module provides a unified interface for different LLM providers,
providing a unified interface for Groq and other future LLM providers.
"""

import asyncio
import logging
import os
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, Any, Optional, List
from enum import Enum

logger = logging.getLogger(__name__)


class LLMProvider(str, Enum):
    """Supported LLM providers."""
    GROQ = "groq"


class LLMService(ABC):
    """Abstract base class for LLM services."""

    def __init__(self, provider: LLMProvider, model_name: str):
        self.provider = provider
        self.model_name = model_name
        self.logger = logging.getLogger(f"{__name__}.{provider.value}")

    @abstractmethod
    async def generate_response(
        self,
        prompt: str,
        stream: bool = False,
        **kwargs
    ) -> str:
        """
        Generate a response from the LLM.

        Args:
            prompt: The input prompt
            stream: Whether to stream the response
            **kwargs: Additional provider-specific parameters

        Returns:
            Generated response text
        """
        pass

    @abstractmethod
    async def generate_streaming_response(
        self,
        prompt: str,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Generate a streaming response from the LLM.

        Args:
            prompt: The input prompt
            **kwargs: Additional provider-specific parameters

        Yields:
            Response chunks as they arrive
        """
        pass

    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """
        Check the health of the LLM service.

        Returns:
            Health status information
        """
        pass

    @abstractmethod
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the model.

        Returns:
            Model information
        """
        pass


class LLMServiceFactory:
    """Factory class for creating LLM service instances."""

    _instances: Dict[str, LLMService] = {}

    @classmethod
    def get_service(
        self,
        provider: LLMProvider = None,
        model_name: str = None,
        **config
    ) -> LLMService:
        """
        Get or create an LLM service instance.

        Args:
            provider: LLM provider to use
            model_name: Model name
            **config: Additional configuration

        Returns:
            LLM service instance
        """
        # Get from environment if not specified
        if provider is None:
            provider_str = os.getenv("LLM_PROVIDER", "groq")
            provider = LLMProvider(provider_str)

        if model_name is None:
            model_name = os.getenv("LLM_MODEL_NAME", "llama-3.1-8b-instant")

        # Create cache key
        cache_key = f"{provider.value}_{model_name}"

        # Return cached instance if available
        if cache_key in self._instances:
            return self._instances[cache_key]

        # Create new instance
        if provider == LLMProvider.GROQ:
            from .groq_service import GroqService
            service = GroqService(model_name, **config)
        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")

        # Cache and return
        self._instances[cache_key] = service
        logger.info(f"Created {provider.value} service with model {model_name}")

        return service

    @classmethod
    def clear_cache(cls):
        """Clear the service instance cache."""
        cls._instances.clear()


# Convenience function for getting the default service
def get_default_llm_service() -> LLMService:
    """Get the default Groq LLM service."""
    return LLMServiceFactory.get_service()