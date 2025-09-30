import logging
import os

import debugpy
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .errors.database_errors import ServiceError
from .middleware.auth_middleware import AuthMiddleware
# Removed https_enforcement - not needed
# from .middleware.https_enforcement import HTTPSEnforcementMiddleware
from .middleware.rate_limit import RateLimitMiddleware
from .routes import auth, documents, messages, spaces, upload

if os.getenv("ENVIRONMENT", "") == "development":
    debugpy.listen(("0.0.0.0", 5678))

load_dotenv()

LOG_LEVELS = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
    "CRITICAL": logging.CRITICAL
}
logging.basicConfig(
    level=LOG_LEVELS.get(os.getenv("LOG_LEVEL", "INFO"), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


app = FastAPI(
    title="📄 Documents Hub API",
    description="API for managing documents and interacting with a RAG system. Current version: v1",
    version="1.0.0",
    openapi_tags=auth.tags_metadata +
                spaces.tags_metadata + 
                messages.tags_metadata +
                documents.tags_metadata +
                upload.tags_metadata +
                [{"name": "info", "description": "API information and versioning"}],
    docs_url="/docs",
    redoc_url="/redoc"
)

# Middleware setup
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE_MB", "50")) * 1024 * 1024  # 50MB limit
async def file_size_middleware(app, request: Request, call_next):
    if request.method == "POST" and "multipart/form-data" in request.headers.get("content-type", ""):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_UPLOAD_SIZE:
            return JSONResponse(
                status_code=413,
                content={
                    "detail": f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)}MB",
                    "error_code": "file_too_large"
                }
            )
    return await call_next(request)

class FileSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        return await file_size_middleware(self.app, request, call_next)

if os.getenv("ENVIRONMENT") == "production":
    
    FALLBACK_ALLOWED_ORIGINS = [
        "https://www.yourdomain.com"
    ]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.getenv("ALLOWED_ORIGINS", ",".join(FALLBACK_ALLOWED_ORIGINS)).split(","),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
    # Removed HTTPS enforcement middleware
    # app.add_middleware(HTTPSEnforcementMiddleware)
    app.add_middleware(RateLimitMiddleware, calls=100, period=60)

else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.add_middleware(FileSizeLimitMiddleware)
app.add_middleware(AuthMiddleware)

API_V1_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=f"{API_V1_PREFIX}/auth")
app.include_router(upload.router, prefix=f"{API_V1_PREFIX}/upload")
app.include_router(documents.router, prefix=f"{API_V1_PREFIX}")
app.include_router(spaces.router, prefix=f"{API_V1_PREFIX}/spaces")
app.include_router(messages.router, prefix=f"{API_V1_PREFIX}/spaces")

# API Info endpoint
@app.get("/", tags=["info"])
async def api_info():
    return {
        "name": "Documents Hub API",
        "version": "1.0.0",
        "description": "API for managing documents and interacting with a RAG system",
        "current_version": "v1",
        "available_versions": ["v1"],
        "endpoints": {
            "v1": f"{API_V1_PREFIX}",
            "docs": "/docs",
            "redoc": "/redoc"
        },
        "features": [
            "Document upload and processing",
            "RAG-based question answering",
            "Space management",
            "Message history",
            "Async processing",
            "JWT authentication",
            "OAuth integration"
        ]
    }

# Global exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_details = exc.errors()
    error_message = "; ".join(f"{err['loc'][-1]}: {err['msg']}" for err in error_details)
    logger.warning(f"Validation error: {error_message}, path={request.url.path}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Invalid input data",
            "error_code": "validation_error"
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.error(f"HTTP error occurred: {exc.detail} at {request.url.path}, status_code={exc.status_code}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail
        }
    )
    
@app.exception_handler(ServiceError)
async def service_exception_handler(request: Request, exc: ServiceError):
    status_code_map = {
        "not_found": status.HTTP_404_NOT_FOUND,
        "permission_denied": status.HTTP_403_FORBIDDEN,
        "conflict_error": status.HTTP_409_CONFLICT,
        "database_error": status.HTTP_503_SERVICE_UNAVAILABLE,
    }
    status_code = status_code_map.get(exc.code, status.HTTP_500_INTERNAL_SERVER_ERROR)
    log_level = logging.WARNING if status_code in (status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN) else logging.ERROR
    logger.log(log_level, f"Service error occurred: {exc.message}, code={exc.code}, path={request.url.path}")
    return JSONResponse(
        status_code=status_code,
        content={
            "detail": "Service error occurred",
            "error_code": exc.code
        }
    )
    
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unexpected error: {str(exc)}, path={request.url.path}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected error occurred",
            "error_code": "unexpected_error"
        }
    )