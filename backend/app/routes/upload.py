import logging
import uuid
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from ..errors.database_errors import DatabaseError
from ..errors.document_processor_errors import DocumentCorruptedError, EmptyDocumentError, UnsupportedDocumentTypeError
from ..errors.embedding_errors import ChunkingError, EmbeddingError
from ..errors.file_errors import EmptyFileError, FileSaveError
from ..errors.metadata_extractor_errors import MetadataExtractorError
from ..errors.qdrant_errors import QdrantError
from ..errors.web_scraper_errors import ContentExtractionError, InvalidURLError, URLFetchError
from ..models.upload import Base64UploadRequest, UploadResponse, WebDocumentUploadRequest
from ..services import db_handler, document_processor, embedding, file_service, metadata_extractor, qdrant_client, web_scraper

logger = logging.getLogger(__name__)
router = APIRouter()

def get_current_user_id_from_query(current_user_id: uuid.UUID = Query(..., description="Current user ID")) -> uuid.UUID:
    return current_user_id


@router.post("/base64", response_model=UploadResponse, status_code=201)
def upload_base64(
    request: Base64UploadRequest, 
    current_user_id: uuid.UUID = Depends(get_current_user_id_from_query)
):
    logger.info(f"Starting base64 upload for user {current_user_id}, file: {request.filename}")
    
    saved_file_path = None
    doc_id = None
    
    try:
        # Process document to extract text
        logger.debug(f"Processing document: {request.filename}")
        pages = document_processor.base64_to_text(
            base64_text=request.content_base64, 
            mime_type=request.mime_type
        )
        
        # Save file to filesystem
        logger.debug(f"Saving file to filesystem")
        saved_file_path = file_service.save_base64_file(
            request.content_base64, 
            request.filename, 
            current_user_id
        )

        # Add document to database
        logger.debug(f"Adding document to database")
        doc_id = db_handler.add_document(
            filename=request.filename,
            file_path=saved_file_path,
            mime_type=request.mime_type,
            uploaded_by=current_user_id,
            space_id=request.space_id
        )
        
        # Prepare metadata for vector storage
        metadata = create_document_metadata(
            document_id=doc_id,
            filename=request.filename,
            mime_type=request.mime_type,
            user_id=current_user_id,
            space_id=request.space_id
        )
        
        # Create embeddings and store in vector database
        logger.debug(f"Creating embeddings and storing in vector database")
        chunks = save_to_vector_db(pages, metadata)
        
        logger.info(f"Successfully uploaded base64 document {request.filename} for user {current_user_id}")
        return UploadResponse(
            status="success",
            document_id=doc_id,
            document_name=request.filename,
            chunk_count=len(chunks),
            file_path=saved_file_path
        )

    except (UnsupportedDocumentTypeError, DocumentCorruptedError, EmptyDocumentError) as e:
        logger.warning(f"Document processing error for {request.filename}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=400, detail=f"Document processing failed: {e.message}")
    except (FileSaveError, EmptyFileError) as e:
        logger.error(f"File save error for {request.filename}: {str(e)}")
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=500, detail=f"File save failed: {e.message}")
    except DatabaseError as e:
        logger.error(f"Database error for {request.filename}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
        raise HTTPException(status_code=500, detail=f"Database error: {e.message}")
    except (EmbeddingError, ChunkingError, MetadataExtractorError, QdrantError) as e:
        logger.error(f"Vector processing error for {request.filename}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=500, detail=f"Vector processing failed: {e.message}")
    except Exception as e:
        logger.error(f"Unexpected error uploading {request.filename}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=500, detail="An unexpected error occurred during upload")

@router.post("/file", response_model=UploadResponse, status_code=201)
async def upload_file_multipart(
    file: UploadFile = File(..., description="File to upload"),
    space_id: uuid.UUID = Form(..., description="ID of the space to upload the document to"),
    current_user_id: uuid.UUID = Depends(get_current_user_id_from_query)
):
    logger.info(f"Starting file upload for user {current_user_id}, file: {file.filename}")
    
    saved_file_path = None
    doc_id = None
    
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        # Read file contents
        logger.debug(f"Reading file contents: {file.filename}")
        contents = await file.read()
        
        if not contents:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        
        # Process document to extract text
        logger.debug(f"Processing document: {file.filename}")
        pages = document_processor.process_document_for_text(contents, file.content_type)
        
        # Reset file position and save to filesystem
        file.file.seek(0)
        logger.debug(f"Saving file to filesystem")
        saved_file_path = file_service.save_file(file, current_user_id)
        
        # Add document to database
        logger.debug(f"Adding document to database")
        doc_id = db_handler.add_document(
            filename=file.filename,
            file_path=saved_file_path,
            mime_type=file.content_type,
            uploaded_by=current_user_id,
            space_id=space_id
        )
        
        # Prepare metadata for vector storage
        metadata = create_document_metadata(
            document_id=doc_id,
            filename=file.filename,
            mime_type=file.content_type,
            user_id=current_user_id,
            space_id=space_id
        )
        
        # Create embeddings and store in vector database
        logger.debug(f"Creating embeddings and storing in vector database")
        chunks = save_to_vector_db(pages, metadata)
        
        logger.info(f"Successfully uploaded file {file.filename} for user {current_user_id}")
        return UploadResponse(
            status="success",
            document_id=doc_id,
            document_name=file.filename,
            chunk_count=len(chunks),
            file_path=saved_file_path
        )
        
    except (UnsupportedDocumentTypeError, DocumentCorruptedError, EmptyDocumentError) as e:
        logger.warning(f"Document processing error for {file.filename}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=400, detail=f"Document processing failed: {e.message}")
    except (FileSaveError, EmptyFileError) as e:
        logger.error(f"File save error for {file.filename}: {str(e)}")
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=500, detail=f"File save failed: {e.message}")
    except DatabaseError as e:
        logger.error(f"Database error for {file.filename}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
        raise HTTPException(status_code=500, detail=f"Database error: {e.message}")
    except (EmbeddingError, ChunkingError, MetadataExtractorError, QdrantError) as e:
        logger.error(f"Vector processing error for {file.filename}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=500, detail=f"Vector processing failed: {e.message}")
    except Exception as e:
        logger.error(f"Unexpected error uploading {file.filename}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=500, detail="An unexpected error occurred during upload")

    
def generate_web_document_filename(url: str) -> str:
    """Generate a safe filename from a URL."""
    try:
        parsed = urlparse(url)
        # Use domain + path for filename
        domain = parsed.netloc.replace('www.', '')
        path = parsed.path.strip('/').replace('/', '_')
        
        if path:
            filename = f"{domain}_{path}"
        else:
            filename = domain
            
        # Clean filename to remove invalid characters
        filename = "".join(c for c in filename if c.isalnum() or c in ('_', '-', '.'))
        
        # Limit length and add extension
        filename = filename[:200] + ".html"
        
        return filename
    except Exception:
        # Fallback to a generic name
        return f"webpage_{uuid.uuid4().hex[:8]}.html"

@router.post("/web", response_model=UploadResponse, status_code=201)
def upload_web_document(
    request: WebDocumentUploadRequest,
    current_user_id: uuid.UUID = Depends(get_current_user_id_from_query)
):
    logger.info(f"Starting web document upload for user {current_user_id}, URL: {request.url}")
    
    doc_id = None
    
    try:
        # Scrape web content
        logger.debug(f"Scraping content from URL: {request.url}")
        page_text, web_metadata = web_scraper.scrape_webpage(request.url)
        
        # Convert to pages format
        pages = [(1, page_text)]
        
        # Generate filename from URL
        filename = generate_web_document_filename(request.url)
        
        # Web documents are not saved to filesystem
        saved_file_path = None
        
        # Add document to database
        logger.debug(f"Adding web document to database")
        doc_id = db_handler.add_document(
            filename=filename,
            file_path="",  # Empty path for web documents
            mime_type="text/html",
            uploaded_by=current_user_id,
            space_id=request.space_id
        )

        # Prepare metadata for vector storage
        metadata = create_document_metadata(
            document_id=doc_id,
            filename=filename,
            mime_type="text/html",
            user_id=current_user_id,
            space_id=request.space_id,
            url=request.url,
            title=web_metadata.get('title', ''),
            author=web_metadata.get('author', ''),
            date=web_metadata.get('date', ''),
            sitename=web_metadata.get('sitename', '')
        )
        
        # Create embeddings and store in vector database
        logger.debug(f"Creating embeddings and storing in vector database")
        chunks = save_to_vector_db(pages, metadata)
        
        logger.info(f"Successfully uploaded web document from {request.url} for user {current_user_id}")
        return UploadResponse(
            status="success",
            document_id=doc_id,
            document_name=filename,
            chunk_count=len(chunks),
            url=request.url
        )
        
    except (InvalidURLError, URLFetchError, ContentExtractionError) as e:
        logger.warning(f"Web scraping error for {request.url}: {str(e)}")
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=400, detail=f"Web scraping failed: {e.message}")
    except DatabaseError as e:
        logger.error(f"Database error for {request.url}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {e.message}")
    except (EmbeddingError, ChunkingError, MetadataExtractorError, QdrantError) as e:
        logger.error(f"Vector processing error for {request.url}: {str(e)}")
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=500, detail=f"Vector processing failed: {e.message}")
    except Exception as e:
        logger.error(f"Unexpected error uploading web document from {request.url}: {str(e)}")
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=500, detail="An unexpected error occurred during upload")
    
    
def create_document_metadata(
    document_id: uuid.UUID,
    filename: str,
    mime_type: str,
    user_id: uuid.UUID,
    space_id: uuid.UUID,
    url: str = "",
    title: str = "",
    author: str = "",
    date: str = "",
    sitename: str = ""
) -> dict:
    """Create standardized metadata object for all document types."""
    return {
        'document_id': str(document_id),
        'filename': filename,
        'mime_type': mime_type,
        'user_id': str(user_id),
        'space_id': str(space_id),
        'url': url,
        'title': title,
        'author': author,
        'date': date,
        'sitename': sitename,
    }

def cleanup_file(file_path: str) -> None:
    """Clean up a file if it exists."""
    try:
        if file_path and Path(file_path).exists():
            file_service.delete_file_and_cleanup(file_path)
            logger.info(f"Cleaned up file: {file_path}")
    except Exception as e:
        logger.warning(f"Failed to cleanup file {file_path}: {str(e)}")

def cleanup_database_document(doc_id: uuid.UUID) -> None:
    """Clean up database document and associated vector data."""
    try:
        db_handler.delete_document(doc_id)
        qdrant_client.delete_document(doc_id)
        logger.info(f"Cleaned up document: {doc_id}")
    except Exception as e:
        logger.warning(f"Failed to cleanup document {doc_id}: {str(e)}")

def save_to_vector_db(pages: list[(int, str)], init_metadata: dict):
    """Process pages into chunks, create embeddings, and store in vector database."""
    logger.debug("Creating chunks from pages")
    chunks, page_numbers = embedding.chunk_pages_with_recursive_chunker(pages=pages)
    
    logger.debug(f"Generating embeddings for {len(chunks)} chunks")
    embeddings = embedding.get_embeddings(chunks=chunks)
        
    logger.debug("Creating metadata for chunks")
    metadata = metadata_extractor.create_metadata(
        chunks=chunks, 
        page_numbers=page_numbers, 
        init_metadata=init_metadata
    )
    
    logger.debug("Storing document in vector database")
    qdrant_client.store_document(
        embeddings=embeddings, 
        chunks=chunks, 
        metadata=metadata
    )
    
    return chunks