import base64
import re
import uuid
from typing import Optional

from pydantic import BaseModel, Field, validator


class Base64UploadRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255, description="Name of the file being uploaded")
    mime_type: str = Field(..., description="MIME type of the file")
    content_base64: str = Field(..., description="Base64 encoded file content")
    space_id: uuid.UUID = Field(..., description="ID of the space to upload the document to")
    
    @validator('mime_type')
    def validate_mime_type(cls, v):
        allowed_types = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
                        'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp', 'image/tiff']
        if v not in allowed_types:
            raise ValueError(f'Unsupported MIME type: {v}. Allowed types: {", ".join(allowed_types)}')
        return v
    
    @validator('content_base64')
    def validate_base64(cls, v):
        try:
            decoded = base64.b64decode(v, validate=True)
            if len(decoded) == 0:
                raise ValueError('Base64 content cannot be empty')
            if len(decoded) > 50 * 1024 * 1024:  # 50MB limit
                raise ValueError('File size cannot exceed 50MB')
            return v
        except Exception:
            raise ValueError('Invalid base64 encoding')
    
    @validator('filename')
    def validate_filename(cls, v):
        # Check for valid filename characters
        if not re.match(r'^[a-zA-Z0-9._-]+\.[a-zA-Z0-9]+$', v):
            raise ValueError('Filename must contain only alphanumeric characters, dots, hyphens, underscores and have an extension')
        return v


class WebDocumentUploadRequest(BaseModel):
    url: str = Field(..., description="URL of the web document to scrape and upload")
    space_id: uuid.UUID = Field(..., description="ID of the space to upload the document to")
    
    @validator('url')
    def validate_url(cls, v):
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+'  # domain...
            r'(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|'  # host...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)
        if not url_pattern.match(v):
            raise ValueError('Invalid URL format')
        return v

class UploadResponse(BaseModel):
    status: str = Field("success", description="Upload status")
    document_id: uuid.UUID = Field(..., description="ID of the uploaded document")
    document_name: str = Field(..., description="Name of the uploaded document")
    chunk_count: int = Field(..., ge=0, description="Number of chunks created from the document")
    file_path: Optional[str] = Field(None, description="Path where the document is stored (if applicable)")
    url: Optional[str] = Field(None, description="Original URL for web documents")