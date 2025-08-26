import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

from ..dependencies.auth import get_current_user
from ..errors.database_errors import DatabaseError, NotFoundError, PermissionError
from ..errors.file_errors import FileDeleteError, FileNotFoundError, FileReadError
from ..errors.qdrant_errors import VectorStoreError
from ..models.documents import (
    ChunkItemResponse,
    ChunkMetadata,
    ChunksResponse,
    DocumentWithChunksResponse, 
    GetChunksRequest, 
    GetDocumentsRequest, 
    GetDocumentsResponseWrapper
)
from ..services import db_handler, file_service, qdrant_client


router = APIRouter()
logger = logging.getLogger(__name__)

tags_metadata = [
    {
        "name": "documents",
        "description": "Operations related to managing documents within spaces."
    }
]


@router.get(
    "/spaces/{space_id}/documents",
    response_model=GetDocumentsResponseWrapper,
    tags=["documents"],
    summary="List documents in a space",
    description="Retrieve a paginated list of documents in a specific space.",
    response_description="A list of documents with pagination metadata.",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "List of documents successfully retrieved"},
        401: {"description": "Authentication required"},
        403: {"description": "Permission denied"},
        404: {"description": "Space not found"},
        500: {"description": "Internal server error"},
        503: {"description": "Database unavailable"}
    }
)
def get_documents(
    space_id: uuid.UUID,
    request: GetDocumentsRequest = Depends(),
    current_user_id: uuid.UUID = Depends(get_current_user)
):
    try:
        # FIRST: Validate space ownership before any processing
        logger.debug(f"Validating space {space_id} ownership for user {current_user_id}")
        db_handler.validate_space_ownership(space_id, current_user_id)
        
        documents, total_count = db_handler.get_paginated_documents(
            current_user_id, space_id, request.limit, request.offset
        )
        return {
            "documents": documents,
            "pagination": {
                "limit": request.limit,
                "offset": request.offset,
                "total_count": total_count
            }
        }
    except NotFoundError as e:
        logger.warning(f"Space {space_id} not found for user {current_user_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except PermissionError as e:
        logger.warning(f"Permission denied for user {current_user_id} on space {space_id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except DatabaseError as e:
        logger.error(f"Database error fetching documents in space {space_id} for user {current_user_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Database error: {e.message}")
    except Exception as e:
        logger.error(f"Unexpected error fetching documents in space {space_id} for user {current_user_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred")


@router.get(
    "/documents/view/{doc_id}",
    tags=["documents"],
    summary="View a document",
    description="Retrieve and view a document file by its ID.",
    response_description="The document file as a file response.",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Document file successfully retrieved"},
        401: {"description": "Authentication required"},
        403: {"description": "Permission denied"},
        404: {"description": "Document not found"},
        422: {"description": "Invalid document ID format"},
        500: {"description": "Internal server error"},
        503: {"description": "Database unavailable"}
    }
)
def view_document(
    doc_id: uuid.UUID,
    current_user_id: uuid.UUID = Depends(get_current_user)
):
    try:
        # Get document with authorization check - only returns user's own documents
        document = db_handler.get_user_document_by_id(doc_id, current_user_id)
        if not document:
            logger.warning(f"Document {doc_id} not found or not owned by user {current_user_id}")
            raise NotFoundError("Document", str(doc_id))
        
        # Additional check: ensure web documents (no file_path) are handled properly
        if not document.file_path:
            logger.warning(f"Document {doc_id} is a web document without file content")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Web documents cannot be downloaded")

        # Get file content using file service
        content, mime_type = file_service.get_file_content(document.file_path)
        
        return FileResponse(
            path=document.file_path,
            media_type=mime_type,
            filename=document.filename,
        )
    except PermissionError as e:
        logger.warning(f"Permission denied for user {current_user_id} to view document {doc_id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except NotFoundError as e:
        logger.warning(f"Document {doc_id} not found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except FileNotFoundError as e:
        logger.error(f"File not found for document {doc_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file not found on disk")
    except FileReadError as e:
        logger.error(f"Failed to read file for document {doc_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to read document file: {e.message}")
    except DatabaseError as e:
        logger.error(f"Database error accessing document {doc_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Database error: {e.message}")
    except Exception as e:
        logger.error(f"Unexpected error viewing document {doc_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred")


@router.get(
    "/documents/{doc_id}",
    response_model=DocumentWithChunksResponse,
    tags=["documents"],
    summary="Get document with chunks",
    description="Retrieve detailed information about a document including its metadata and text chunks from the vector database.",
    response_description="Document information with paginated chunks and their metadata.",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Document and chunks successfully retrieved"},
        401: {"description": "Authentication required"},
        403: {"description": "Permission denied - document not accessible to user"},
        404: {"description": "Document not found"},
        422: {"description": "Invalid document ID format or query parameters"},
        500: {"description": "Internal server error"},
        503: {"description": "Database or vector store unavailable"}
    }
)
def get_document_with_chunks(
    doc_id: uuid.UUID,
    chunks_request: GetChunksRequest = Depends(),
    current_user_id: uuid.UUID = Depends(get_current_user)
):
    try:
        # Get document with authorization check - only returns user's own documents
        document = db_handler.get_user_document_by_id(doc_id, current_user_id)
        if not document:
            logger.warning(f"Document {doc_id} not found or not owned by user {current_user_id}")
            raise NotFoundError("Document", str(doc_id))
        
        # Get chunks from vector database with pagination
        chunks_data, total_chunks = qdrant_client.get_document_chunks(
            document_id=doc_id,
            user_id=current_user_id,
            limit=chunks_request.limit,
            offset=chunks_request.offset
        )
        
        # Extract shared metadata from first chunk (all chunks share the same document metadata)
        shared_metadata = None
        chunk_items = []
        
        if chunks_data:
            first_payload = chunks_data[0].payload
            shared_metadata = ChunkMetadata(
                language=first_payload.get('language', ''),
                topics=first_payload.get('topics', []),
                document_id=first_payload.get('document_id', ''),
                mime_type=first_payload.get('mime_type', ''),
                user_id=first_payload.get('user_id', ''),
                space_id=first_payload.get('space_id', ''),
                title=first_payload.get('title', ''),
                date=first_payload.get('date', ''),
                filename=first_payload.get('filename', ''),
                sitename=first_payload.get('sitename', ''),
                url=first_payload.get('url', '')
            )
            
            # Convert chunks to individual items with only chunk-specific data
            for chunk_point in chunks_data:
                payload = chunk_point.payload
                chunk_items.append(ChunkItemResponse(
                    text=payload.get('text', ''),
                    chunk_index=payload.get('chunk_index', 0),
                    page_number=payload.get('page_number', 1),
                    author=payload.get('author', '')
                ))
        else:
            # If no chunks, create empty metadata from document info
            shared_metadata = ChunkMetadata(
                language='',
                topics=[],
                document_id=str(doc_id),
                mime_type=document.mime_type,
                user_id=str(current_user_id),
                space_id=str(document.space_id),
                title='',
                date='',
                filename=document.filename,
                sitename='',
                url=''
            )
        
        chunks_response = ChunksResponse(
            meta=shared_metadata,
            items=chunk_items,
            pagination={
                "limit": chunks_request.limit,
                "offset": chunks_request.offset,
                "total_count": total_chunks
            }
        )
        
        logger.info(f"Retrieved document {doc_id} with {len(chunk_items)} chunks for user {current_user_id}")
        
        return DocumentWithChunksResponse(
            document=document,
            chunks=chunks_response
        )
        
    except PermissionError as e:
        logger.warning(f"Permission denied for user {current_user_id} to access document {doc_id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except NotFoundError as e:
        logger.warning(f"Document {doc_id} not found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except VectorStoreError as e:
        logger.error(f"Vector store error retrieving chunks for document {doc_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Vector database error: {e.message}")
    except DatabaseError as e:
        logger.error(f"Database error accessing document {doc_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Database error: {e.message}")
    except Exception as e:
        logger.error(f"Unexpected error retrieving document {doc_id} with chunks: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred")


@router.delete(
    "/documents/{doc_id}",
    tags=["documents"],
    summary="Delete a document",
    description="Delete a document and all associated data (file, vector embeddings, database record).",
    response_description="No content returned on successful deletion.",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        204: {"description": "Document successfully deleted"},
        401: {"description": "Authentication required"},
        403: {"description": "Permission denied"},
        404: {"description": "Document not found"},
        422: {"description": "Invalid document ID format"},
        500: {"description": "Internal server error"},
        503: {"description": "Database unavailable"}
    }
)
def delete_document(
    doc_id: uuid.UUID,
    current_user_id: uuid.UUID = Depends(get_current_user)
):
    try:
        # Get document with authorization check - only returns user's own documents
        document = db_handler.get_user_document_by_id(doc_id, current_user_id)
        if not document:
            logger.warning(f"Document {doc_id} not found or not owned by user {current_user_id}")
            raise NotFoundError("Document", str(doc_id))

        # 1. Delete from filesystem using file service (only if file exists)
        if document.file_path:
            file_service.delete_file_and_cleanup(document.file_path)
        
        # 2. Delete from vector database
        qdrant_client.delete_document(doc_id)
        
        # 3. Delete from database
        db_handler.delete_document(doc_id, current_user_id)
        
        logger.info(f"Successfully deleted document {doc_id} for user {current_user_id}")
        return
        
    except PermissionError as e:
        logger.warning(f"Permission denied for user {current_user_id} to delete document {doc_id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except NotFoundError as e:
        logger.warning(f"Document {doc_id} not found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except FileNotFoundError as e:
        logger.warning(f"File not found for document {doc_id}: {str(e)}")
        # Continue with deletion from vector DB and database even if file is missing
        try:
            qdrant_client.delete_document(doc_id)
            db_handler.delete_document(doc_id, current_user_id)
            logger.info(f"Successfully deleted document {doc_id} (file was missing) for user {current_user_id}")
            return
        except Exception as cleanup_e:
            logger.error(f"Failed to cleanup document {doc_id} after missing file: {str(cleanup_e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document cleanup failed")
    except FileDeleteError as e:
        logger.error(f"Failed to delete file for document {doc_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete document file")
    except VectorStoreError as e:
        logger.error(f"Failed to delete from vector store for document {doc_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete from vector database")
    except DatabaseError as e:
        logger.error(f"Database error deleting document {doc_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Database error: {e.message}")
    except Exception as e:
        logger.error(f"Unexpected error deleting document {doc_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred")