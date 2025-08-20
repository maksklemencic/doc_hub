from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import debugpy
from .routes import upload, chat, documents, spaces, messages, users
from backend.app.errors.errors import ServiceError
import os
import logging
from dotenv import load_dotenv

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
    openapi_tags=spaces.tags_metadata,
    docs_url="/docs",
    redoc_url="/redoc"
)
app.include_router(upload.router, prefix="/upload")
app.include_router(chat.router, prefix="/spaces")
app.include_router(documents.router, prefix="/documents")
app.include_router(spaces.router, prefix="/spaces")
app.include_router(messages.router, prefix="/spaces")
app.include_router(users.router, prefix="/users")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_details = exc.errors()
    error_message = "; ".join(f"{err['loc'][-1]}: {err['msg']}" for err in error_details)
    logger.warning(f"Validation error: {error_message}, path={request.url.path}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": error_message,
            "path": request.url.path,
            "error_code": "validation_error"
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.error(f"HTTP error occurred: {exc.detail} at {request.url.path}, status_code={exc.status_code}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "path": request.url.path
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
            "detail": exc.message,
            "path": request.url.path,
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
            "path": request.url.path,
            "error_code": "unexpected_error"
        }
    )

@app.get("/")
def read_root():
    return {"message": "FastAPI is running!"}
