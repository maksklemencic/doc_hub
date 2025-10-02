import base64
import logging
import os
import re
import subprocess
import uuid
from pathlib import Path
from typing import Tuple, Optional

from fastapi import UploadFile

from ..errors.file_errors import EmptyFileError, FileDeleteError, FileNotFoundError, FileReadError, FileSaveError

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

def get_document_type_from_mime(mime_type: str) -> str:
    """Determine document type folder from mime type."""
    if mime_type == "application/pdf":
        return "pdf"
    elif mime_type in [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword"
    ]:
        return "word"
    elif mime_type.startswith("image/"):
        return "image"
    elif mime_type == "text/html":
        return "web"
    else:
        return "other"

def sanitize_filename(filename: str) -> str:
    if not filename:
        raise ValueError("Filename cannot be empty")
    
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    filename = re.sub(r'\.\.+', '.', filename)
    filename = filename.strip('. ')
    
    if not filename:
        filename = f"file_{uuid.uuid4().hex[:8]}"
    
    if len(filename) > 200:
        name, ext = os.path.splitext(filename)
        filename = name[:195] + ext
    
    return filename

def is_safe_path(base_path: str, path: Path) -> bool:
    try:
        base_path_resolved = Path(base_path).resolve()
        path_resolved = path.resolve()
        return path_resolved.is_relative_to(base_path_resolved)
    except (OSError, ValueError):
        return False

def save_file(upload_file: UploadFile, user_id: uuid.UUID, space_id: Optional[uuid.UUID] = None, mime_type: Optional[str] = None) -> str:
    logger.info(f"Saving file '{upload_file.filename}' for user {user_id}")

    try:
        safe_filename = sanitize_filename(upload_file.filename)
        extension = Path(safe_filename).suffix
        base_name = Path(safe_filename).stem
        unique_filename = f"{uuid.uuid4()}_{base_name}{extension}"

        # Determine mime type
        detected_mime_type = mime_type or upload_file.content_type or "application/octet-stream"
        doc_type = get_document_type_from_mime(detected_mime_type)

        # Create directory structure: /uploads/{user_id}/{space_id}/{doc_type}/
        if space_id:
            type_dir = Path(UPLOAD_DIR) / str(user_id) / str(space_id) / doc_type
        else:
            type_dir = Path(UPLOAD_DIR) / str(user_id) / doc_type

        type_dir.mkdir(parents=True, exist_ok=True)

        file_path = type_dir / unique_filename

        if not is_safe_path(UPLOAD_DIR, file_path):
            raise ValueError("Invalid file path - potential directory traversal")

        upload_file.file.seek(0)
        file_bytes = upload_file.file.read()
        if not file_bytes:
            raise EmptyFileError(upload_file.filename)

        with file_path.open("wb") as f:
            f.write(file_bytes)

        logger.info(f"Successfully saved file '{upload_file.filename}' for user {user_id} in {doc_type}/")
        return str(file_path)
    except EmptyFileError:
        raise
    except Exception as e:
        logger.error(f"Failed to save file '{upload_file.filename}' for user {user_id}: {str(e)}")
        raise FileSaveError(str(file_path) if 'file_path' in locals() else upload_file.filename, str(e))

def save_base64_file(content_base64: str, filename: str, user_id: uuid.UUID, space_id: Optional[uuid.UUID] = None, mime_type: Optional[str] = None) -> str:
    logger.info(f"Saving base64 file '{filename}' for user {user_id}")

    try:
        safe_filename = sanitize_filename(filename)

        extension = Path(safe_filename).suffix
        base_name = Path(safe_filename).stem
        unique_filename = f"{uuid.uuid4()}_{base_name}{extension}"

        # Determine mime type from extension if not provided
        if not mime_type:
            import mimetypes
            mime_type, _ = mimetypes.guess_type(filename)
            mime_type = mime_type or "application/octet-stream"

        doc_type = get_document_type_from_mime(mime_type)

        # Create directory structure: /uploads/{user_id}/{space_id}/{doc_type}/
        if space_id:
            type_dir = Path(UPLOAD_DIR) / str(user_id) / str(space_id) / doc_type
        else:
            type_dir = Path(UPLOAD_DIR) / str(user_id) / doc_type

        type_dir.mkdir(parents=True, exist_ok=True)

        file_path = type_dir / unique_filename

        if not is_safe_path(UPLOAD_DIR, file_path):
            raise ValueError("Invalid file path - potential directory traversal")

        file_bytes = base64.b64decode(content_base64)
        if not file_bytes:
            raise EmptyFileError(filename)

        with file_path.open("wb") as f:
            f.write(file_bytes)

        logger.info(f"Successfully saved base64 file '{filename}' for user {user_id} in {doc_type}/")
        return str(file_path)
    except EmptyFileError:
        raise
    except Exception as e:
        logger.error(f"Failed to save base64 file '{filename}' for user {user_id}: {str(e)}")
        raise FileSaveError(str(file_path) if 'file_path' in locals() else filename, str(e))


def convert_word_to_pdf(docx_path: str) -> str:
    """
    Convert a Word document to PDF using LibreOffice.

    Args:
        docx_path: Path to the .docx or .doc file

    Returns:
        Path to the generated PDF file

    Raises:
        FileSaveError: If conversion fails
    """
    logger.info(f"Converting Word document to PDF: {docx_path}")

    docx_path_obj = Path(docx_path)
    if not docx_path_obj.exists():
        raise FileNotFoundError(docx_path)

    try:
        output_dir = docx_path_obj.parent

        # Use LibreOffice in headless mode to convert to PDF
        # The converted PDF will be placed in the same directory with _converted.pdf suffix
        result = subprocess.run(
            [
                "libreoffice",
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(output_dir),
                str(docx_path_obj)
            ],
            capture_output=True,
            text=True,
            timeout=60  # 60 second timeout
        )

        if result.returncode != 0:
            error_msg = result.stderr or result.stdout or "Unknown error"
            logger.error(f"LibreOffice conversion failed: {error_msg}")
            raise FileSaveError(docx_path, f"PDF conversion failed: {error_msg}")

        # LibreOffice creates a file with the same base name but .pdf extension
        # We need to rename it to include _converted suffix
        base_name = docx_path_obj.stem
        temp_pdf_path = output_dir / f"{base_name}.pdf"
        final_pdf_path = output_dir / f"{base_name}_converted.pdf"

        if temp_pdf_path.exists():
            # Rename to _converted.pdf
            temp_pdf_path.rename(final_pdf_path)
            logger.info(f"Successfully converted Word document to PDF: {final_pdf_path}")
            return str(final_pdf_path)
        else:
            raise FileSaveError(docx_path, "PDF file not created by LibreOffice")

    except subprocess.TimeoutExpired:
        logger.error(f"Word to PDF conversion timed out for {docx_path}")
        raise FileSaveError(docx_path, "PDF conversion timed out")
    except Exception as e:
        logger.error(f"Failed to convert Word to PDF: {str(e)}")
        raise FileSaveError(docx_path, f"PDF conversion failed: {str(e)}")


def get_file_content(file_path: str) -> Tuple[bytes, str]:
    logger.info(f"Reading file content from {file_path}")

    path_obj = Path(file_path)
    if not path_obj.exists():
        logger.warning(f"File not found: {file_path}")
        raise FileNotFoundError(file_path)

    try:
        with path_obj.open("rb") as f:
            content = f.read()

        import mimetypes
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = "application/octet-stream"

        logger.info(f"Successfully read file {file_path} ({len(content)} bytes)")
        return content, mime_type
    except Exception as e:
        logger.error(f"Failed to read file {file_path}: {str(e)}")
        raise FileReadError(file_path, str(e))


def save_text_variants(
    original_file_path: str,
    raw_text: str,
    cleaned_text: str,
    markdown_text: str
) -> Tuple[str, str, str]:
    """
    Save raw text, cleaned text, and markdown versions alongside the original document.

    Args:
        original_file_path: Path to the original uploaded document
        raw_text: Raw extracted text (unprocessed)
        cleaned_text: Cleaned text optimized for RAG (generated from markdown)
        markdown_text: Unified markdown (vision-extracted or LLM-converted)

    Returns:
        Tuple of (raw_text_path, cleaned_text_path, markdown_path)
    """
    logger.info(f"Saving text variants for document: {original_file_path}")

    try:
        original_path = Path(original_file_path)
        base_dir = original_path.parent
        base_name = original_path.stem  # filename without extension

        # Create paths for text variants
        raw_text_path = base_dir / f"{base_name}_raw.txt"
        cleaned_text_path = base_dir / f"{base_name}_cleaned.txt"
        markdown_path = base_dir / f"{base_name}.md"

        # Validate paths
        if not is_safe_path(UPLOAD_DIR, raw_text_path):
            raise ValueError("Invalid raw text path - potential directory traversal")
        if not is_safe_path(UPLOAD_DIR, cleaned_text_path):
            raise ValueError("Invalid cleaned text path - potential directory traversal")
        if not is_safe_path(UPLOAD_DIR, markdown_path):
            raise ValueError("Invalid markdown path - potential directory traversal")

        # Save raw text
        with raw_text_path.open("w", encoding="utf-8") as f:
            f.write(raw_text)
        logger.debug(f"Saved raw text to: {raw_text_path}")

        # Save cleaned text (optimized for RAG)
        with cleaned_text_path.open("w", encoding="utf-8") as f:
            f.write(cleaned_text)
        logger.debug(f"Saved cleaned text to: {cleaned_text_path}")

        # Save unified markdown
        with markdown_path.open("w", encoding="utf-8") as f:
            f.write(markdown_text)
        logger.debug(f"Saved markdown to: {markdown_path}")

        logger.info(f"Successfully saved all text variants for: {original_file_path}")
        return str(raw_text_path), str(cleaned_text_path), str(markdown_path)

    except Exception as e:
        logger.error(f"Failed to save text variants for {original_file_path}: {str(e)}")
        raise FileSaveError(original_file_path, f"Failed to save text variants: {str(e)}")


def delete_file_and_cleanup(file_path: str) -> None:
    """
    Delete a file and its related variants (markdown, text, converted PDF).
    Also cleanup empty directories.
    """
    logger.info(f"Deleting file: {file_path}")

    path_obj = Path(file_path)
    if not path_obj.exists():
        logger.warning(f"File not found for deletion: {file_path}")
        raise FileNotFoundError(file_path)

    try:
        base_dir = path_obj.parent
        base_name = path_obj.stem

        # Delete main file
        path_obj.unlink()
        logger.info(f"Successfully deleted file: {file_path}")

        # Delete related files (markdown, text variants, converted PDF)
        related_files = [
            base_dir / f"{base_name}.md",
            base_dir / f"{base_name}_raw.txt",
            base_dir / f"{base_name}_cleaned.txt",
            base_dir / f"{base_name}_converted.pdf",  # For Word docs
        ]

        for related_file in related_files:
            if related_file.exists():
                try:
                    related_file.unlink()
                    logger.debug(f"Deleted related file: {related_file}")
                except Exception as e:
                    logger.warning(f"Failed to delete related file {related_file}: {str(e)}")

        # Cleanup empty directories (type folder, space folder, user folder)
        current_dir = base_dir
        for _ in range(3):  # Check up to 3 levels (type/space/user)
            if current_dir.exists() and not any(current_dir.iterdir()):
                try:
                    current_dir.rmdir()
                    logger.info(f"Cleaned up empty folder: {current_dir}")
                    current_dir = current_dir.parent
                except Exception as e:
                    logger.warning(f"Failed to cleanup folder {current_dir}: {str(e)}")
                    break
            else:
                break

    except Exception as e:
        logger.error(f"Failed to delete file {file_path}: {str(e)}")
        raise FileDeleteError(file_path, str(e))