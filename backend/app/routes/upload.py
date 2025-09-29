import logging
import os
import uuid
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from ..dependencies.auth import get_current_user
from ..errors.database_errors import DatabaseError, NotFoundError, PermissionError
from ..errors.document_processor_errors import DocumentCorruptedError, EmptyDocumentError, UnsupportedDocumentTypeError
from ..errors.embedding_errors import ChunkingError, EmbeddingError
from ..errors.file_errors import EmptyFileError, FileSaveError
from ..errors.metadata_extractor_errors import MetadataExtractorError
from ..errors.qdrant_errors import VectorStoreError
from ..errors.web_scraper_errors import ContentExtractionError, InvalidURLError, URLFetchError
from ..models.upload import Base64UploadRequest, UploadResponse, WebDocumentUploadRequest
from ..agents.document_processing_agent import DocumentProcessingAgent
from ..services import db_handler, document_processor, embedding, file_service, metadata_extractor, qdrant_client, web_scraper

logger = logging.getLogger(__name__)
router = APIRouter()

tags_metadata = [
    {
        "name": "upload",
        "description": "Endpoints for uploading documents via various methods including base64, file upload, and web scraping."
    }
]


@router.post(
    "/base64", 
    response_model=UploadResponse, 
    status_code=status.HTTP_201_CREATED,
    tags=["upload"],
    summary="Upload a base64-encoded document",
    description="Uploads a document provided as a base64-encoded string, processes it, and stores it in the specified space.",
    response_description="Details of the uploaded document including ID, name, chunk count, and file path.",
    responses={
        201: {"description": "Document successfully uploaded"},
        400: {"description": "Bad request; Invalid input or document processing error"},
        401: {"description": "Authentication required"},
        404: {"description": "Space not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
        503: {"description": "Database or vector store unavailable"}
    }
)
async def upload_base64(
    request: Base64UploadRequest,
    current_user_id: uuid.UUID = Depends(get_current_user)
):
    logger.info(f"Starting base64 upload for user {current_user_id}, file: {request.filename}")
    
    saved_file_path = None
    doc_id = None
    
    try:
        # FIRST: Validate space ownership before any processing
        logger.debug(f"Validating space {request.space_id} ownership for user {current_user_id}")
        db_handler.validate_space_ownership(request.space_id, current_user_id)
        
        logger.debug(f"Processing document with Document Processing Agent: {request.filename}")

        # Initialize Document Processing Agent
        doc_agent = DocumentProcessingAgent()

        # Prepare agent input
        agent_input = {
            "file_bytes": request.content_base64,  # base64 string
            "mime_type": request.mime_type,
            "filename": request.filename,
            "enable_llm_cleaning": True,  # Enable enhanced processing
            "enable_quality_assessment": True
        }

        # Execute document processing agent with fallback
        try:
            agent_result = await doc_agent.execute(agent_input)

            # Extract results for compatibility with existing workflow
            pages = agent_result["original_pages"]
            processed_text = agent_result["processed_text"]
            language = agent_result.get("language", "unknown")
            quality_score = agent_result.get("quality_score", 0.5)

            logger.info(
                f"Document processing complete: {request.filename} "
                f"(language: {language}, quality: {quality_score:.2f})"
            )
        except Exception as agent_error:
            logger.warning(
                f"Document Processing Agent failed for {request.filename}: {str(agent_error)}"
            )
            logger.info("Falling back to direct document processor")

            # Fallback to original processing
            pages = document_processor.base64_to_text(
                base64_text=request.content_base64,
                mime_type=request.mime_type
            )
            processed_text = "\n\n".join([text for _, text in pages])
            language = "unknown"
            quality_score = None
        
        logger.debug(f"Saving file to filesystem")
        saved_file_path = file_service.save_base64_file(
            request.content_base64,
            request.filename,
            current_user_id
        )

        # Calculate file size from saved file
        import os
        file_size = os.path.getsize(saved_file_path) if saved_file_path else None

        logger.debug(f"Adding document to database")
        doc_id = db_handler.add_document(
            filename=request.filename,
            file_path=saved_file_path,
            mime_type=request.mime_type,
            uploaded_by=current_user_id,
            space_id=request.space_id,
            file_size=file_size
        )
        
        metadata = {
            # Basic metadata
            "document_id": str(doc_id),
            "filename": request.filename or "",
            "mime_type": request.mime_type or "",
            "user_id": str(current_user_id),
            "space_id": str(request.space_id),
            # Enhanced metadata from Document Processing Agent
            "language": language,
            "processed_with_agent": quality_score is not None,
            **({"quality_score": quality_score} if quality_score is not None else {})
        }
        
        # metadata = metadata_extractor.create_document_metadata(
        #     document_id=doc_id,
        #     filename=request.filename,
        #     mime_type=request.mime_type,
        #     user_id=current_user_id,
        #     space_id=request.space_id
        # )
        
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

    except NotFoundError as e:
        logger.warning(f"Space not found for {request.filename}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=404, detail=e.message)
    except PermissionError as e:
        logger.warning(f"Permission denied for {request.filename}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=403, detail=e.message)
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
        raise HTTPException(status_code=503, detail=f"Database error: {e.message}")
    except (EmbeddingError, ChunkingError, MetadataExtractorError, VectorStoreError) as e:
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

@router.post("/file",
            response_model=UploadResponse,
            status_code=status.HTTP_201_CREATED,
            tags=["upload"],
            summary="Upload a document via multipart/form-data",
            description="Uploads a document via multipart/form-data, processes it, and stores it in the specified space.",
            response_description="Details of the uploaded document including ID, name, chunk count, and file path.",
            responses={
                201: {"description": "Document successfully uploaded"},
                400: {"description": "Bad request; Invalid input or document processing error"},
                401: {"description": "Authentication required"},
                404: {"description": "Space not found"},
                422: {"description": "Validation error"},
                500: {"description": "Internal server error"},
                503: {"description": "Database or vector store unavailable"}
            }
)
async def upload_file_multipart(
    file: UploadFile = File(..., description="File to upload"),
    space_id: uuid.UUID = Form(..., description="ID of the space to upload the document to"),
    current_user_id: uuid.UUID = Depends(get_current_user)
):
    logger.info(f"Starting file upload for user {current_user_id}, file: {file.filename}")

    saved_file_path = None
    doc_id = None

    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")

        # FIRST: Validate space ownership before any processing
        logger.debug(f"Validating space {space_id} ownership for user {current_user_id}")
        db_handler.validate_space_ownership(space_id, current_user_id)

        logger.debug(f"Reading file contents: {file.filename}")
        contents = await file.read()

        if not contents:
            raise HTTPException(status_code=400, detail="Empty file uploaded")

        logger.debug(f"Processing document with Document Processing Agent: {file.filename}")

        # Initialize Document Processing Agent
        doc_agent = DocumentProcessingAgent()

        # Prepare agent input
        agent_input = {
            "file_bytes": contents,  # raw bytes
            "mime_type": file.content_type,
            "filename": file.filename,
            "enable_llm_cleaning": True,  # Enable enhanced processing
            "enable_quality_assessment": True
        }

        # Execute document processing agent with fallback
        try:
            agent_result = await doc_agent.execute(agent_input)

            # Extract results for compatibility with existing workflow
            pages = agent_result["original_pages"]
            processed_text = agent_result["processed_text"]
            language = agent_result.get("language", "unknown")
            quality_score = agent_result.get("quality_score", 0.5)

            logger.info(
                f"Document processing complete: {file.filename} "
                f"(language: {language}, quality: {quality_score:.2f})"
            )
        except Exception as agent_error:
            logger.warning(
                f"Document Processing Agent failed for {file.filename}: {str(agent_error)}"
            )
            logger.info("Falling back to direct document processor")

            # Fallback to original processing
            pages = document_processor.process_document_for_text(contents, file.content_type)
            processed_text = "\n\n".join([text for _, text in pages])
            language = "unknown"
            quality_score = None

        # Reset file position and save to filesystem
        file.file.seek(0)
        logger.debug(f"Saving file to filesystem")
        saved_file_path = file_service.save_file(file, current_user_id)

        # Get file size from the uploaded file
        file_size = len(contents)

        logger.debug(f"Adding document to database")
        doc_id = db_handler.add_document(
            filename=file.filename,
            file_path=saved_file_path,
            mime_type=file.content_type,
            uploaded_by=current_user_id,
            space_id=space_id,
            file_size=file_size
        )

        metadata = {
            # Basic metadata
            "document_id": str(doc_id),
            "filename": file.filename or "",
            "mime_type": file.content_type or "",
            "user_id": str(current_user_id),
            "space_id": str(space_id),
            # Enhanced metadata from Document Processing Agent
            "language": language,
            "processed_with_agent": quality_score is not None,
            **({"quality_score": quality_score} if quality_score is not None else {})
        }

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

    except NotFoundError as e:
        logger.warning(f"Space not found for {file.filename}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=404, detail=e.message)
    except PermissionError as e:
        logger.warning(f"Permission denied for {file.filename}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=403, detail=e.message)
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
        raise HTTPException(status_code=503, detail=f"Database error: {e.message}")
    except (EmbeddingError, ChunkingError, MetadataExtractorError, VectorStoreError) as e:
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
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.replace('www.', '')
        path = parsed.path.strip('/').replace('/', '_')
        
        if path:
            filename = f"{domain}_{path}"
        else:
            filename = domain
            
        filename = "".join(c for c in filename if c.isalnum() or c in ('_', '-', '.'))
        filename = filename[:200] + ".html"
        
        return filename
    except Exception:
        return f"webpage_{uuid.uuid4().hex[:8]}.html"

@router.post("/web", 
            response_model=UploadResponse, 
            status_code=status.HTTP_201_CREATED,
            tags=["upload"],
            summary="Upload a document from a web URL",
            description="Fetches and processes a document from the provided web URL, then stores it in the specified space.",
            response_description="Details of the uploaded document including ID, name, chunk count, and URL.",
            responses={
                201: {"description": "Document successfully uploaded"},
                400: {"description": "Bad request; Invalid URL or web scraping error"},
                401: {"description": "Authentication required"},
                404: {"description": "Space not found"},
                422: {"description": "Validation error"},
                500: {"description": "Internal server error"},
                503: {"description": "Database or vector store unavailable"}
            }
)
def upload_web_document(
    request: WebDocumentUploadRequest,
    current_user_id: uuid.UUID = Depends(get_current_user)
):
    logger.info(f"Starting web document upload for user {current_user_id}, URL: {request.url}")
    
    doc_id = None
    
    try:
        # FIRST: Validate space ownership before any processing
        logger.debug(f"Validating space {request.space_id} ownership for user {current_user_id}")
        db_handler.validate_space_ownership(request.space_id, current_user_id)
        
        logger.debug(f"Scraping content from URL: {request.url}")
        page_text, web_metadata = web_scraper.scrape_webpage(request.url)
        
        pages = [(1, page_text)]
        
        filename = generate_web_document_filename(request.url)
        
        saved_file_path = None
        
        logger.debug(f"Adding web document to database")
        doc_id = db_handler.add_document(
            filename=filename,
            file_path="",  # Empty path for web documents
            mime_type="text/html",
            uploaded_by=current_user_id,
            space_id=request.space_id,
            file_size=None  # Web documents don't have file sizes
        )
        
        metadata = {
            # Basic metadata
            "document_id": str(doc_id),
            "filename": filename,
            "mime_type": "text/html",
            "user_id": str(current_user_id),
            "space_id": str(request.space_id),
            # Other metadata fields
            "url": request.url,
            "title": web_metadata.get('title', ''),
            "author": web_metadata.get('author', ''),
            "date": web_metadata.get('date', ''),
            "sitename": web_metadata.get('sitename', ''),
        }

        # metadata = metadata_extractor.create_document_metadata(
        #     document_id=doc_id,
        #     filename=filename,
        #     mime_type="text/html",
        #     user_id=current_user_id,
        #     space_id=request.space_id,
        #     url=request.url,
        #     title=web_metadata.get('title', ''),
        #     author=web_metadata.get('author', ''),
        #     date=web_metadata.get('date', ''),
        #     sitename=web_metadata.get('sitename', '')
        # )
        
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
        
    except NotFoundError as e:
        logger.warning(f"Space not found for {request.url}: {str(e)}")
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=404, detail=e.message)
    except PermissionError as e:
        logger.warning(f"Permission denied for {request.url}: {str(e)}")
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=403, detail=e.message)
    except (InvalidURLError, URLFetchError, ContentExtractionError) as e:
        logger.warning(f"Web scraping error for {request.url}: {str(e)}")
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=400, detail=f"Web scraping failed: {e.message}")
    except DatabaseError as e:
        logger.error(f"Database error for {request.url}: {str(e)}")
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=503, detail=f"Database error: {e.message}")
    except (EmbeddingError, ChunkingError, MetadataExtractorError, VectorStoreError) as e:
        logger.error(f"Vector processing error for {request.url}: {str(e)}")
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=500, detail=f"Vector processing failed: {e.message}")
    except Exception as e:
        logger.error(f"Unexpected error uploading web document from {request.url}: {str(e)}")
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=500, detail="An unexpected error occurred during upload")


def cleanup_file(file_path: str) -> None:
    try:
        if file_path and Path(file_path).exists():
            file_service.delete_file_and_cleanup(file_path)
            logger.info(f"Cleaned up file: {file_path}")
    except Exception as e:
        logger.warning(f"Failed to cleanup file {file_path}: {str(e)}")

def cleanup_database_document(doc_id: uuid.UUID) -> None:
    db_success = False
    vector_success = False
    
    # Try to delete from database (no authorization needed for cleanup)
    try:
        db_handler.delete_document(doc_id)  # No user_id for cleanup operations
        db_success = True
        logger.debug(f"Successfully deleted document {doc_id} from database")
    except Exception as e:
        logger.warning(f"Failed to delete document {doc_id} from database: {str(e)}")
    
    # Try to delete from vector store
    try:
        qdrant_client.delete_document(doc_id)
        vector_success = True
        logger.debug(f"Successfully deleted document {doc_id} from vector store")
    except Exception as e:
        logger.warning(f"Failed to delete document {doc_id} from vector store: {str(e)}")
    
    if db_success and vector_success:
        logger.info(f"Cleaned up document {doc_id} successfully")
    else:
        logger.warning(f"Partial cleanup of document {doc_id} - DB: {db_success}, Vector: {vector_success}")

def save_to_vector_db(pages: list[(int, str)], init_metadata: dict):
    logger.debug("Creating chunks from pages")
    chunks, page_numbers = embedding.chunk_pages_with_recursive_chunker(pages=pages)
    
    logger.debug(f"Generating embeddings for {len(chunks)} chunks")
    embeddings = embedding.get_embeddings(chunks=chunks)
        
    logger.debug("Creating extended metadata for chunks")
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