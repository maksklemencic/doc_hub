import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict

from .shared import PaginationMetadata

class ChunkItemResponse(BaseModel):
    """Individual chunk with only chunk-specific metadata."""
    text: str = Field(..., description="The text content of the chunk.")
    chunk_index: int = Field(..., ge=0, description="Zero-based index of the chunk within the document.")
    page_number: int = Field(..., ge=1, description="Page number where this chunk was found.")

class ChunkMetadata(BaseModel):
    """Global metadata shared across all chunks in a document."""
    language: str = Field("", description="Detected language of the document.")
    topics: List[str] = Field(default_factory=list, description="Extracted topic keywords for the document.")
    document_id: str = Field(..., description="UUID of the document this chunk belongs to.")
    mime_type: str = Field("", description="MIME type of the source document.")
    user_id: str = Field(..., description="UUID of the user who owns this document.")
    space_id: str = Field(..., description="UUID of the space this document belongs to.")
    title: str = Field("", description="Title of the document (if available).")
    author: str = Field("", description="Author of the document (if available).")
    date: str = Field("", description="Date/timestamp of the document (if available).")
    filename: str = Field("", description="Original filename of the document.")
    sitename: str = Field("", description="Site name for web documents (if applicable).")
    url: str = Field("", description="URL for web documents (if applicable).")

class ChunksResponse(BaseModel):
    """Chunks with shared metadata and individual items."""
    meta: ChunkMetadata = Field(..., description="Global metadata shared across all chunks.")
    items: List[ChunkItemResponse] = Field(..., description="List of individual chunks with chunk-specific data.")
    pagination: PaginationMetadata = Field(..., description="Pagination metadata for chunks.")

class GetChunksRequest(BaseModel):
    limit: int = Field(50, ge=1, le=200, description="Number of chunks to return per page.")
    offset: int = Field(0, ge=0, description="Number of chunks to skip before starting the page.")

class DocumentResponse(BaseModel):
    id: uuid.UUID = Field(..., description="Unique identifier (UUID) of the document.")
    filename: str = Field(..., min_length=1, max_length=255, description="Name of the document file.")
    file_path: str = Field(..., description="Path where the document is stored.")
    mime_type: str = Field(..., description="MIME type of the document.")
    uploaded_by: uuid.UUID = Field(..., description="Unique identifier of the user who uploaded the document.")
    space_id: uuid.UUID = Field(..., description="Unique identifier of the space the document belongs to.")
    created_at: Optional[datetime] = Field(None, description="Timestamp when the document was uploaded, in ISO 8601 format.")
    updated_at: Optional[datetime] = Field(None, description="Timestamp when the document was last updated, in ISO 8601 format.")
    
    model_config = ConfigDict(from_attributes=True)
        
class DocumentWithChunksResponse(BaseModel):
    document: DocumentResponse = Field(..., description="Document information from the database.")
    chunks: ChunksResponse = Field(..., description="Text chunks with shared metadata and pagination.")

class GetDocumentsRequest(BaseModel):
    limit: int = Field(10, ge=1, le=100, description="Number of documents to return per page.")
    offset: int = Field(0, ge=0, description="Number of documents to skip before starting the page.")

class GetDocumentsResponseWrapper(BaseModel):
    documents: List[DocumentResponse]
    pagination: PaginationMetadata = Field(..., description="Pagination metadata including limit, offset, and total count.")