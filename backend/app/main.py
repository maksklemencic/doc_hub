import logging
import os

import debugpy
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .errors.database_errors import ServiceError
from .middleware.auth_middleware import AuthMiddleware
from .middleware.rate_limit import RateLimitMiddleware
from .routes import auth, documents, messages, spaces, upload

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

if os.getenv("DEBUG_MODE", "false").lower() == "true":
    debugpy.listen(("0.0.0.0", 5678))

app = FastAPI(
    title="📄 Documents Hub API",
    description="API for managing documents and interacting with a RAG system.",
    version="1.0.0",
    openapi_tags=auth.tags_metadata +
                spaces.tags_metadata + 
                messages.tags_metadata +
                documents.tags_metadata +
                upload.tags_metadata,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add middlewares
app.add_middleware(AuthMiddleware)  # JWT authentication middleware
app.add_middleware(RateLimitMiddleware, calls=100, period=60)  # 100 requests per minute

# Include routers
app.include_router(auth.router, prefix="/auth")
app.include_router(upload.router, prefix="/upload")
app.include_router(documents.router)
app.include_router(spaces.router, prefix="/spaces")
app.include_router(messages.router, prefix="/spaces")
# User management is now handled entirely through OAuth (/auth endpoints)
# app.include_router(users.router, prefix="/users")  # Removed - OAuth handles all user operations

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