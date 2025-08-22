import os
import uuid
import logging
from pathlib import Path
from fastapi import UploadFile
import base64
from typing import Tuple

from ..errors.file_errors import FileNotFoundError, FileDeleteError, FileReadError, FileSaveError, EmptyFileError

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")

Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

def save_file(upload_file: UploadFile, user_id: uuid.UUID) -> str:
    """Save an uploaded file to the filesystem."""
    logger.info(f"Saving file '{upload_file.filename}' for user {user_id}")
    
    try:
        extension = Path(upload_file.filename).suffix
        base_name = Path(upload_file.filename).stem
        unique_filename = f"{uuid.uuid4()}_{base_name}{extension}"

        user_dir = Path(UPLOAD_DIR) / str(user_id)
        user_dir.mkdir(parents=True, exist_ok=True)

        file_path = user_dir / unique_filename

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
        user_folder = Path(UPLOAD_DIR) / str(user_id)
        user_folder.mkdir(parents=True, exist_ok=True)
        
        extension = Path(filename).suffix
        base_name = Path(filename).stem
        unique_filename = f"{uuid.uuid4()}_{base_name}{extension}"

        file_path = user_folder / unique_filename

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