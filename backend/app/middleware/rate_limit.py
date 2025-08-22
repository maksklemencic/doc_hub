import asyncio
import logging
import time
from typing import Dict, Tuple

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiting middleware."""
    
    def __init__(self, app, calls: int = 100, period: int = 60):
        super().__init__(app)
        self.calls = calls
        self.period = period
        self.clients: Dict[str, Tuple[int, float]] = {}
        self._cleanup_task = None
        
    async def dispatch(self, request: Request, call_next):
        # Get client identifier (IP address)
        client_ip = self._get_client_ip(request)
        
        # Check rate limit
        if self._is_rate_limited(client_ip):
            logger.warning(f"Rate limit exceeded for client {client_ip}")
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again later.",
                headers={"Retry-After": str(self.period)}
            )
        
        # Record the request
        self._record_request(client_ip)
        
        # Process the request
        response = await call_next(request)
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request."""
        # Check for forwarded headers first (for proxy/load balancer setups)
        if "x-forwarded-for" in request.headers:
            return request.headers["x-forwarded-for"].split(",")[0].strip()
        if "x-real-ip" in request.headers:
            return request.headers["x-real-ip"]
        
        # Fall back to client host
        return request.client.host if request.client else "unknown"
    
    def _is_rate_limited(self, client_ip: str) -> bool:
        """Check if client has exceeded rate limit."""
        current_time = time.time()
        
        if client_ip not in self.clients:
            return False
        
        request_count, window_start = self.clients[client_ip]
        
        # Reset window if period has passed
        if current_time - window_start >= self.period:
            return False
        
        # Check if limit exceeded
        return request_count >= self.calls
    
    def _record_request(self, client_ip: str):
        """Record a request for the client."""
        current_time = time.time()
        
        if client_ip not in self.clients:
            self.clients[client_ip] = (1, current_time)
            return
        
        request_count, window_start = self.clients[client_ip]
        
        # Reset window if period has passed
        if current_time - window_start >= self.period:
            self.clients[client_ip] = (1, current_time)
        else:
            self.clients[client_ip] = (request_count + 1, window_start)
    
    async def cleanup_old_entries(self):
        """Periodically clean up old entries to prevent memory leaks."""
        while True:
            try:
                current_time = time.time()
                expired_clients = [
                    client_ip for client_ip, (_, window_start) in self.clients.items()
                    if current_time - window_start >= self.period
                ]
                
                for client_ip in expired_clients:
                    del self.clients[client_ip]
                
                if expired_clients:
                    logger.debug(f"Cleaned up {len(expired_clients)} expired rate limit entries")
                
                # Sleep for half the period before next cleanup
                await asyncio.sleep(self.period / 2)
                
            except Exception as e:
                logger.error(f"Error during rate limit cleanup: {str(e)}")
                await asyncio.sleep(60)  # Wait a minute on error


class EndpointRateLimiter:
    """Decorator for endpoint-specific rate limiting."""
    
    def __init__(self, calls: int = 10, period: int = 60):
        self.calls = calls
        self.period = period
        self.clients: Dict[str, Dict[str, Tuple[int, float]]] = {}
    
    def __call__(self, func):
        async def wrapper(*args, **kwargs):
            # Extract request from kwargs (assumes request is passed)
            request = None
            for arg in args:
                if hasattr(arg, 'client'):
                    request = arg
                    break
            
            if not request:
                # If no request found, proceed without rate limiting
                return await func(*args, **kwargs)
            
            client_ip = self._get_client_ip(request)
            endpoint = f"{request.method}:{request.url.path}"
            
            if self._is_rate_limited(client_ip, endpoint):
                logger.warning(f"Endpoint rate limit exceeded for {client_ip} on {endpoint}")
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded for this endpoint. Please try again later.",
                    headers={"Retry-After": str(self.period)}
                )
            
            self._record_request(client_ip, endpoint)
            return await func(*args, **kwargs)
        
        return wrapper
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request."""
        if "x-forwarded-for" in request.headers:
            return request.headers["x-forwarded-for"].split(",")[0].strip()
        if "x-real-ip" in request.headers:
            return request.headers["x-real-ip"]
        return request.client.host if request.client else "unknown"
    
    def _is_rate_limited(self, client_ip: str, endpoint: str) -> bool:
        """Check if client has exceeded rate limit for specific endpoint."""
        current_time = time.time()
        
        if client_ip not in self.clients:
            self.clients[client_ip] = {}
        
        if endpoint not in self.clients[client_ip]:
            return False
        
        request_count, window_start = self.clients[client_ip][endpoint]
        
        # Reset window if period has passed
        if current_time - window_start >= self.period:
            return False
        
        # Check if limit exceeded
        return request_count >= self.calls
    
    def _record_request(self, client_ip: str, endpoint: str):
        """Record a request for the client and endpoint."""
        current_time = time.time()
        
        if client_ip not in self.clients:
            self.clients[client_ip] = {}
        
        if endpoint not in self.clients[client_ip]:
            self.clients[client_ip][endpoint] = (1, current_time)
            return
        
        request_count, window_start = self.clients[client_ip][endpoint]
        
        # Reset window if period has passed
        if current_time - window_start >= self.period:
            self.clients[client_ip][endpoint] = (1, current_time)
        else:
            self.clients[client_ip][endpoint] = (request_count + 1, window_start)