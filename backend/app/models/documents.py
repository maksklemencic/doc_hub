import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from .shared import PaginationMetadata

class DocumentResponse(BaseModel):
    id: uuid.UUID = Field(..., description="Unique identifier (UUID) of the document.")
    filename: str = Field(..., min_length=1, max_length=255, description="Name of the document file.")
    file_path: str = Field(..., description="Path where the document is stored.")
    mime_type: str = Field(..., description="MIME type of the document.")
    uploaded_by: uuid.UUID = Field(..., description="Unique identifier of the user who uploaded the document.")
    space_id: uuid.UUID = Field(..., description="Unique identifier of the space the document belongs to.")
    created_at: Optional[datetime] = Field(None, description="Timestamp when the document was uploaded, in ISO 8601 format.")
    updated_at: Optional[datetime] = Field(None, description="Timestamp when the document was last updated, in ISO 8601 format.")
    
    class Config:
        from_attributes = True

class GetDocumentsRequest(BaseModel):
    limit: int = Field(10, ge=1, le=100, description="Number of documents to return per page.")
    offset: int = Field(0, ge=0, description="Number of documents to skip before starting the page.")

class GetDocumentsResponseWrapper(BaseModel):
    documents: List[DocumentResponse]
    pagination: PaginationMetadata = Field(..., description="Pagination metadata including limit, offset, and total count.")