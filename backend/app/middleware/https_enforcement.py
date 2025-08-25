"""
HTTPS Enforcement Middleware

Enforces HTTPS connections in production environments and provides security headers.
"""
import logging
import os
from typing import Dict, Optional

from fastapi import Request
from fastapi.responses import RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class HTTPSEnforcementMiddleware(BaseHTTPMiddleware):
    """Middleware to enforce HTTPS and add security headers."""
    
    def __init__(self, app, enforce_https: bool = None, hsts_max_age: int = 31536000):
        super().__init__(app)
        # Only enforce HTTPS in production unless explicitly set
        self.enforce_https = enforce_https if enforce_https is not None else os.getenv("ENVIRONMENT", "development") == "production"
        self.hsts_max_age = hsts_max_age
        
    async def dispatch(self, request: Request, call_next):
        # HTTPS enforcement
        if self.enforce_https and not self._is_secure_request(request):
            # Redirect HTTP to HTTPS
            secure_url = request.url.replace(scheme="https")
            logger.info(f"Redirecting HTTP to HTTPS: {request.url} -> {secure_url}")
            return RedirectResponse(url=str(secure_url), status_code=301)
        
        # Process the request
        response = await call_next(request)
        
        # Add security headers
        self._add_security_headers(response, request)
        
        return response
    
    def _is_secure_request(self, request: Request) -> bool:
        """Check if the request is secure (HTTPS)."""
        # Check direct HTTPS
        if request.url.scheme == "https":
            return True
        
        # Check for forwarded headers (proxy/load balancer scenarios)
        forwarded_proto = request.headers.get("x-forwarded-proto")
        if forwarded_proto and forwarded_proto.lower() == "https":
            return True
        
        # Check for CloudFlare headers
        cf_visitor = request.headers.get("cf-visitor")
        if cf_visitor and '"scheme":"https"' in cf_visitor:
            return True
        
        return False
    
    def _add_security_headers(self, response, request: Request):
        """Add security headers to the response."""
        headers_to_add: Dict[str, str] = {}
        
        # HSTS (HTTP Strict Transport Security) - only for HTTPS requests
        if self._is_secure_request(request):
            headers_to_add["Strict-Transport-Security"] = f"max-age={self.hsts_max_age}; includeSubDomains"
        
        # Content Security Policy - basic protection
        headers_to_add["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'"
        )
        
        # Other security headers
        headers_to_add.update({
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
        })
        
        # Add headers to response
        for header_name, header_value in headers_to_add.items():
            response.headers[header_name] = header_value


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Lightweight middleware that only adds security headers (no HTTPS enforcement)."""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Add basic security headers
        security_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY", 
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "strict-origin-when-cross-origin",
        }
        
        for header_name, header_value in security_headers.items():
            response.headers[header_name] = header_value
        
        return response