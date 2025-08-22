import base64
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Tuple

from fastapi import UploadFile

from ..errors.file_errors import EmptyFileError, FileDeleteError, FileNotFoundError, FileReadError, FileSaveError

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")

Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal and invalid characters."""
    if not filename:
        raise ValueError("Filename cannot be empty")
    
    # Remove or replace dangerous characters
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    filename = re.sub(r'\.\.+', '.', filename)  # Replace multiple dots
    filename = filename.strip('. ')  # Remove leading/trailing dots and spaces
    
    # Ensure filename is not empty after sanitization
    if not filename:
        filename = f"file_{uuid.uuid4().hex[:8]}"
    
    # Limit filename length
    if len(filename) > 200:
        name, ext = os.path.splitext(filename)
        filename = name[:195] + ext
    
    return filename

def is_safe_path(base_path: str, path: Path) -> bool:
    """Check if path is within the base directory (prevents directory traversal)."""
    try:
        base_path_resolved = Path(base_path).resolve()
        path_resolved = path.resolve()
        return path_resolved.is_relative_to(base_path_resolved)
    except (OSError, ValueError):
        return False

def save_file(upload_file: UploadFile, user_id: uuid.UUID) -> str:
    """Save an uploaded file to the filesystem."""
    logger.info(f"Saving file '{upload_file.filename}' for user {user_id}")
    
    try:
        # Sanitize filename to prevent path traversal
        safe_filename = sanitize_filename(upload_file.filename)
        extension = Path(safe_filename).suffix
        base_name = Path(safe_filename).stem
        unique_filename = f"{uuid.uuid4()}_{base_name}{extension}"

        # Ensure user_id is valid UUID (additional security check)
        user_id_str = str(user_id)
        if not user_id_str or '..' in user_id_str or '/' in user_id_str or '\\' in user_id_str:
            raise ValueError("Invalid user ID")

        user_dir = Path(UPLOAD_DIR) / user_id_str
        user_dir.mkdir(parents=True, exist_ok=True)

        file_path = user_dir / unique_filename
        
        # Validate final path is within upload directory
        if not is_safe_path(UPLOAD_DIR, file_path):
            raise ValueError("Invalid file path - potential directory traversal")

        upload_file.file.seek(0)
        file_bytes = upload_file.file.read()
        if not file_bytes:
            raise EmptyFileError(upload_file.filename)

        with file_path.open("wb") as f:
            f.write(file_bytes)

        logger.info(f"Successfully saved file '{upload_file.filename}' for user {user_id}")
        return str(file_path)
    except EmptyFileError:
        raise
    except Exception as e:
        logger.error(f"Failed to save file '{upload_file.filename}' for user {user_id}: {str(e)}")
        raise FileSaveError(str(file_path) if 'file_path' in locals() else upload_file.filename, str(e))

def save_base64_file(content_base64: str, filename: str, user_id: uuid.UUID) -> str:
    """Save a base64-encoded file to the filesystem."""
    logger.info(f"Saving base64 file '{filename}' for user {user_id}")
    
    try:
        # Sanitize filename to prevent path traversal
        safe_filename = sanitize_filename(filename)
        
        # Ensure user_id is valid UUID (additional security check)
        user_id_str = str(user_id)
        if not user_id_str or '..' in user_id_str or '/' in user_id_str or '\\' in user_id_str:
            raise ValueError("Invalid user ID")

        user_folder = Path(UPLOAD_DIR) / user_id_str
        user_folder.mkdir(parents=True, exist_ok=True)
        
        extension = Path(safe_filename).suffix
        base_name = Path(safe_filename).stem
        unique_filename = f"{uuid.uuid4()}_{base_name}{extension}"

        file_path = user_folder / unique_filename
        
        # Validate final path is within upload directory
        if not is_safe_path(UPLOAD_DIR, file_path):
            raise ValueError("Invalid file path - potential directory traversal")

        file_bytes = base64.b64decode(content_base64)
        if not file_bytes:
            raise EmptyFileError(filename)
            
        with file_path.open("wb") as f:
            f.write(file_bytes)

        logger.info(f"Successfully saved base64 file '{filename}' for user {user_id}")
        return str(file_path)
    except EmptyFileError:
        raise
    except Exception as e:
        logger.error(f"Failed to save base64 file '{filename}' for user {user_id}: {str(e)}")
        raise FileSaveError(str(file_path) if 'file_path' in locals() else filename, str(e))


def get_file_content(file_path: str) -> Tuple[bytes, str]:
    """Read file content and return bytes with MIME type."""
    logger.info(f"Reading file content from {file_path}")
    
    path_obj = Path(file_path)
    if not path_obj.exists():
        logger.warning(f"File not found: {file_path}")
        raise FileNotFoundError(file_path)
    
    try:
        with path_obj.open("rb") as f:
            content = f.read()
        
        # Determine MIME type
        import mimetypes
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = "application/octet-stream"
        
        logger.info(f"Successfully read file {file_path} ({len(content)} bytes)")
        return content, mime_type
    except Exception as e:
        logger.error(f"Failed to read file {file_path}: {str(e)}")
        raise FileReadError(file_path, str(e))


def delete_file_and_cleanup(file_path: str) -> None:
    """Delete a file and cleanup empty parent directories."""
    logger.info(f"Deleting file: {file_path}")
    
    path_obj = Path(file_path)
    if not path_obj.exists():
        logger.warning(f"File not found for deletion: {file_path}")
        raise FileNotFoundError(file_path)
    
    try:
        # Delete the file
        path_obj.unlink()
        logger.info(f"Successfully deleted file: {file_path}")
        
        # Clean up empty parent directory (user folder)
        user_folder = path_obj.parent
        if user_folder.exists() and not any(user_folder.iterdir()):
            user_folder.rmdir()
            logger.info(f"Cleaned up empty user folder: {user_folder}")
            
    except Exception as e:
        logger.error(f"Failed to delete file {file_path}: {str(e)}")
        raise FileDeleteError(file_path, str(e))