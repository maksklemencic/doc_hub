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
        
        logger.debug(f"Saving file to filesystem")
        saved_file_path = file_service.save_base64_file(
            request.content_base64,
            request.filename,
            current_user_id,
            space_id=request.space_id,
            mime_type=request.mime_type
        )

        # For Word documents, convert to PDF first for better vision extraction
        converted_pdf_path = None
        processing_file_path = saved_file_path
        processing_mime_type = request.mime_type

        if request.mime_type in [
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword"
        ]:
            logger.debug(f"Converting Word document to PDF for processing")
            try:
                converted_pdf_path = file_service.convert_word_to_pdf(saved_file_path)
                logger.info(f"Successfully converted Word document to PDF: {converted_pdf_path}")
                # Process the PDF instead of the Word doc for better vision extraction
                processing_file_path = converted_pdf_path
                processing_mime_type = "application/pdf"

                # Read the PDF bytes for processing
                with open(converted_pdf_path, 'rb') as f:
                    processing_bytes = f.read()
            except Exception as conversion_error:
                logger.warning(f"Failed to convert Word document to PDF: {str(conversion_error)}")
                # Continue with original Word doc
                processing_bytes = request.content_base64

        else:
            processing_bytes = request.content_base64

        logger.debug(f"Processing document with Document Processing Agent: {request.filename}")

        # Initialize Document Processing Agent
        doc_agent = DocumentProcessingAgent()

        # Prepare agent input - use converted PDF for Word docs if available
        agent_input = {
            "file_bytes": processing_bytes,  # base64 string or bytes
            "mime_type": processing_mime_type,
            "filename": request.filename,
            "enable_llm_cleaning": True,  # Enable enhanced processing
            "enable_quality_assessment": True
        }

        # Execute document processing agent with fallback
        try:
            agent_result = await doc_agent.execute(agent_input)

            # Extract results - use markdown_pages for better chunking
            pages = agent_result.get("markdown_pages", agent_result["original_pages"])  # NEW: Prefer markdown
            raw_text = agent_result.get("raw_text", "")
            cleaned_text = agent_result.get("cleaned_text", "")
            markdown_text = agent_result.get("markdown_text", "")
            used_vision = agent_result.get("used_vision", False)
            language = agent_result.get("language", "unknown")
            quality_score = agent_result.get("quality_score", 0.5)

            logger.info(
                f"Document processing complete: {request.filename} "
                f"(language: {language}, quality: {quality_score:.2f}, vision: {used_vision})"
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
            raw_text = "\n\n".join([text for _, text in pages])
            cleaned_text = raw_text
            markdown_text = raw_text
            language = "unknown"
            quality_score = None
            used_vision = False

        # Save text variants (raw, cleaned, markdown)
        logger.debug(f"Saving text variants")
        try:
            raw_path, cleaned_path, markdown_path = file_service.save_text_variants(
                saved_file_path,
                raw_text,
                cleaned_text,
                markdown_text
            )
            logger.info(f"Saved text variants: raw={raw_path}, cleaned={cleaned_path}, md={markdown_path}")
        except Exception as text_save_error:
            logger.warning(f"Failed to save text variants: {str(text_save_error)}")
            # Continue even if text variants fail to save

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
        
        # Standardized metadata schema (always includes all fields with defaults)
        metadata = {
            # Basic metadata
            "document_id": str(doc_id),
            "filename": request.filename or "",
            "mime_type": request.mime_type or "",
            "user_id": str(current_user_id),
            "space_id": str(request.space_id),

            # Processing metadata (always present with defaults)
            "language": language or "unknown",
            "quality_score": quality_score if quality_score is not None else 0.0,
            "used_vision": used_vision,

            # Web-specific fields (empty for non-web documents)
            "url": "",
            "title": "",
            "author": "",
            "date": "",
            "sitename": "",
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

        # Reset file position and save to filesystem first
        file.file.seek(0)
        logger.debug(f"Saving file to filesystem")
        saved_file_path = file_service.save_file(file, current_user_id, space_id=space_id, mime_type=file.content_type)

        # For Word documents, convert to PDF first for better vision extraction
        converted_pdf_path = None
        processing_bytes = contents
        processing_mime_type = file.content_type

        if file.content_type in [
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword"
        ]:
            logger.debug(f"Converting Word document to PDF for processing")
            try:
                converted_pdf_path = file_service.convert_word_to_pdf(saved_file_path)
                logger.info(f"Successfully converted Word document to PDF: {converted_pdf_path}")
                # Process the PDF instead of the Word doc for better vision extraction
                processing_mime_type = "application/pdf"

                # Read the PDF bytes for processing
                with open(converted_pdf_path, 'rb') as f:
                    processing_bytes = f.read()
            except Exception as conversion_error:
                logger.warning(f"Failed to convert Word document to PDF: {str(conversion_error)}")
                # Continue with original Word doc
                pass

        logger.debug(f"Processing document with Document Processing Agent: {file.filename}")

        # Initialize Document Processing Agent
        doc_agent = DocumentProcessingAgent()

        # Prepare agent input - use converted PDF bytes for Word docs if available
        agent_input = {
            "file_bytes": processing_bytes,  # raw bytes
            "mime_type": processing_mime_type,
            "filename": file.filename,
            "enable_llm_cleaning": True,  # Enable enhanced processing
            "enable_quality_assessment": True
        }

        # Execute document processing agent with fallback
        try:
            agent_result = await doc_agent.execute(agent_input)

            # Extract results - use markdown_pages for better chunking
            pages = agent_result.get("markdown_pages", agent_result["original_pages"])  # NEW: Prefer markdown
            raw_text = agent_result.get("raw_text", "")
            cleaned_text = agent_result.get("cleaned_text", "")
            markdown_text = agent_result.get("markdown_text", "")
            used_vision = agent_result.get("used_vision", False)
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
            raw_text = "\n\n".join([text for _, text in pages])
            cleaned_text = raw_text
            markdown_text = raw_text
            language = "unknown"
            quality_score = None
            used_vision = False

        # Save text variants (raw, cleaned, markdown)
        logger.debug(f"Saving text variants")
        try:
            raw_path, cleaned_path, markdown_path = file_service.save_text_variants(
                saved_file_path,
                raw_text,
                cleaned_text,
                markdown_text
            )
            logger.info(f"Saved text variants: raw={raw_path}, cleaned={cleaned_path}, md={markdown_path}")
        except Exception as text_save_error:
            logger.warning(f"Failed to save text variants: {str(text_save_error)}")
            # Continue even if text variants fail to save

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

        # Standardized metadata schema (always includes all fields with defaults)
        metadata = {
            # Basic metadata
            "document_id": str(doc_id),
            "filename": file.filename or "",
            "mime_type": file.content_type or "",
            "user_id": str(current_user_id),
            "space_id": str(space_id),

            # Processing metadata (always present with defaults)
            "language": language or "unknown",
            "quality_score": quality_score if quality_score is not None else 0.0,
            "used_vision": used_vision,

            # Web-specific fields (empty for non-web documents)
            "url": "",
            "title": "",
            "author": "",
            "date": "",
            "sitename": "",
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
            description="Captures a screenshot of the webpage, processes it with vision model, and stores it in the specified space. Falls back to text scraping if screenshot fails.",
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
async def upload_web_document(
    request: WebDocumentUploadRequest,
    current_user_id: uuid.UUID = Depends(get_current_user)
):
    logger.info(f"Starting web document upload for user {current_user_id}, URL: {request.url}")

    doc_id = None
    saved_file_path = None

    try:
        # FIRST: Validate space ownership before any processing
        logger.debug(f"Validating space {request.space_id} ownership for user {current_user_id}")
        db_handler.validate_space_ownership(request.space_id, current_user_id)

        filename = generate_web_document_filename(request.url)

        # NEW APPROACH: Try screenshot capture first
        logger.debug(f"Attempting screenshot capture for URL: {request.url}")
        screenshot_bytes = None
        used_screenshot = False

        try:
            from ..services import screenshot_service
            screenshot_bytes = await screenshot_service.capture_webpage_with_fallback(request.url)

            if screenshot_bytes:
                logger.info(f"Successfully captured screenshot for {request.url}")
                used_screenshot = True

                # Save screenshot as PNG file
                import io
                from PIL import Image
                screenshot_filename = filename.replace('.html', '.png')

                # Save screenshot using file_service (as 'web' type)
                # We'll create a temporary UploadFile-like object
                from fastapi import UploadFile
                screenshot_file = io.BytesIO(screenshot_bytes)

                # Determine the web folder path
                from pathlib import Path
                web_folder = Path(file_service.UPLOAD_DIR) / str(current_user_id) / str(request.space_id) / "web"
                web_folder.mkdir(parents=True, exist_ok=True)

                screenshot_path = web_folder / f"{uuid.uuid4()}_{screenshot_filename}"

                # Save screenshot
                with screenshot_path.open('wb') as f:
                    f.write(screenshot_bytes)

                saved_file_path = str(screenshot_path)
                logger.info(f"Saved screenshot to: {saved_file_path}")

                # Process screenshot with Document Processing Agent (as image with custom prompt)
                logger.debug(f"Processing screenshot with Document Processing Agent")
                doc_agent = DocumentProcessingAgent()

                agent_input = {
                    "file_bytes": screenshot_bytes,
                    "mime_type": "image/png",
                    "filename": screenshot_filename,
                    "enable_llm_cleaning": True,
                    "enable_quality_assessment": False,
                    "custom_vision_prompt": """You are analyzing a webpage screenshot. Extract ALL the main content of the page, filtering out navigation, UI elements, and distractions, but keeping all article metadata and content.

Your task:
1. **IGNORE completely:**
   - Navigation bars, menus, and breadcrumbs
   - Sidebars with links or widgets
   - Site headers and footers (logos, copyright, contact info)
   - Advertisements and promotional banners
   - Cookie notices and popups
   - Social media sharing buttons
   - Comment sections (unless they're the main content)
   - Related articles/recommended content boxes
   - Search bars and login forms

2. **EXTRACT the main article/content (INCLUDING ALL METADATA):**
   - Article title (use # for h1)
   - **Author name(s)** - if visible, extract exactly as shown
   - **Publication date** - extract the date if shown (e.g., "January 15, 2024")
   - **Subtitle or summary bullets** - if there's a bulleted list right after the title, extract ALL bullets
   - All section headings (use ##, ### for subheadings)
   - All body text and paragraphs - extract EVERY paragraph completely
   - All bullet lists and numbered lists with ALL items
   - Tables with actual data (not navigation)
   - Relevant images with descriptions (if they're part of the article)
   - Charts, graphs, or diagrams that support the content
   - Code snippets or examples (if present)

3. **Format as clean markdown:**
   - Use # for main title
   - Add author and date on separate lines below title if present (e.g., "**Author:** Name" and "**Date:** Date")
   - Use ##/### for subheadings
   - Preserve ALL text structure and paragraphs
   - Format lists with - or 1. 2. 3. - include EVERY list item
   - Use **bold** and *italic* where appropriate
   - Tables in markdown format
   - Code blocks with ```
   - Maintain document flow and structure

4. **CRITICAL RULES:**
   - Extract EVERY piece of main content - do not skip paragraphs, bullets, or sections
   - Include ALL metadata (author, date, subtitle bullets) that appears near the title
   - Output ONLY the main content - no navigation, no ads, no UI chrome
   - If you see multiple articles/posts, extract only the primary one
   - Do NOT include "Share this article" or similar UI text
   - Do NOT include website navigation links
   - Do NOT summarize or shorten - extract the FULL text
   - If unsure whether something is main content or UI, include it if it's near the article

Extract the complete main content with all metadata now:"""
                }

                agent_result = await doc_agent.execute(agent_input)
                pages = agent_result.get("markdown_pages", agent_result["original_pages"])  # NEW: Prefer markdown
                raw_text = agent_result.get("raw_text", "")
                cleaned_text = agent_result.get("cleaned_text", "")
                markdown_text = agent_result.get("markdown_text", "")
                used_vision = agent_result.get("used_vision", False)
                language = agent_result.get("language", "unknown")

                # Save text variants
                try:
                    file_service.save_text_variants(
                        saved_file_path,
                        raw_text,
                        cleaned_text,
                        markdown_text
                    )
                except Exception as text_error:
                    logger.warning(f"Failed to save text variants: {str(text_error)}")

        except Exception as screenshot_error:
            logger.warning(f"Screenshot capture failed: {str(screenshot_error)}")
            screenshot_bytes = None

        # FALLBACK: Use old text scraping method if screenshot failed
        if not screenshot_bytes:
            logger.info(f"Falling back to text scraping for {request.url}")
            page_text, web_metadata = web_scraper.scrape_webpage(request.url)
            pages = [(1, page_text)]
            raw_text = page_text
            cleaned_text = page_text
            markdown_text = page_text
            language = "unknown"
            used_vision = False  # Mark that vision was not used
        else:
            # Get metadata from scraping anyway (for title, author, etc.)
            try:
                _, web_metadata = web_scraper.scrape_webpage(request.url)
            except Exception as meta_error:
                logger.warning(f"Failed to extract metadata: {str(meta_error)}")
                web_metadata = {}

        # Calculate file size
        file_size = len(screenshot_bytes) if screenshot_bytes else None

        logger.debug(f"Adding web document to database")
        doc_id = db_handler.add_document(
            filename=filename,
            file_path=saved_file_path or "",  # Empty if no screenshot
            mime_type="text/html",  # Always store as web document type, regardless of screenshot
            uploaded_by=current_user_id,
            space_id=request.space_id,
            file_size=file_size
        )

        # Standardized metadata schema (always includes all fields with defaults)
        metadata = {
            # Basic metadata
            "document_id": str(doc_id),
            "filename": filename,
            "mime_type": "text/html",  # Always store as web document type
            "user_id": str(current_user_id),
            "space_id": str(request.space_id),

            # Processing metadata (always present with defaults)
            "language": language or "unknown",
            "quality_score": 0.0,  # Not assessed for web docs yet
            "used_vision": used_screenshot,  # True if screenshot+vision used

            # Web-specific metadata (populated for web documents)
            "url": request.url,
            "title": web_metadata.get('title', ''),
            "author": web_metadata.get('author', ''),
            "date": web_metadata.get('date', ''),
            "sitename": web_metadata.get('sitename', ''),
        }

        logger.debug(f"Creating embeddings and storing in vector database")
        chunks = save_to_vector_db(pages, metadata)

        logger.info(f"Successfully uploaded web document from {request.url} for user {current_user_id} (screenshot: {used_screenshot})")
        return UploadResponse(
            status="success",
            document_id=doc_id,
            document_name=filename,
            chunk_count=len(chunks),
            url=request.url
        )

    except NotFoundError as e:
        logger.warning(f"Space not found for {request.url}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=404, detail=e.message)
    except PermissionError as e:
        logger.warning(f"Permission denied for {request.url}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=403, detail=e.message)
    except (InvalidURLError, URLFetchError, ContentExtractionError) as e:
        logger.warning(f"Web scraping error for {request.url}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=400, detail=f"Web scraping failed: {e.message}")
    except DatabaseError as e:
        logger.error(f"Database error for {request.url}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=503, detail=f"Database error: {e.message}")
    except (EmbeddingError, ChunkingError, MetadataExtractorError, VectorStoreError) as e:
        logger.error(f"Vector processing error for {request.url}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
        if doc_id:
            cleanup_database_document(doc_id)
        raise HTTPException(status_code=500, detail=f"Vector processing failed: {e.message}")
    except Exception as e:
        logger.error(f"Unexpected error uploading web document from {request.url}: {str(e)}")
        if saved_file_path:
            cleanup_file(saved_file_path)
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
    """
    Chunk and store document in vector database.
    Uses advanced MarkdownChunker for better semantic chunking.
    """
    logger.debug("Creating chunks from pages using MarkdownChunker")

    # Import chunking service
    from ..services import chunking_service

    # Use MarkdownChunker for better semantic boundary detection
    chunk_texts, page_numbers, chunk_metadata_list = chunking_service.chunk_pages_with_markdown_chunker(
        pages=pages,
        base_metadata=init_metadata,
        max_chunk_size=1000,
        min_chunk_size=100,
        overlap_size=100
    )

    logger.debug(f"Generating embeddings for {len(chunk_texts)} chunks")
    # Pass language hint for better multilingual embeddings
    language = init_metadata.get("language", "unknown")
    embeddings = embedding.get_embeddings(chunks=chunk_texts, language=language)

    logger.debug("Creating extended metadata for chunks with enhanced fields")
    # Create metadata using enhanced ChunkMetadata objects
    metadata = metadata_extractor.create_metadata_from_chunk_objects(
        chunk_metadata_list=chunk_metadata_list,
        init_metadata=init_metadata
    )

    logger.debug("Storing document in vector database")
    qdrant_client.store_document(
        embeddings=embeddings,
        chunks=chunk_texts,
        metadata=metadata
    )

    return chunk_texts