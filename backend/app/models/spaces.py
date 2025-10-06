import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict, field_validator

from .shared import PaginationMetadata

# Common Lucide icon names used in the app
ALLOWED_ICONS = {
    'Folder', 'Star', 'Heart', 'FileText', 'Image', 'Video', 'Music',
    'BookOpen', 'Briefcase', 'Calendar', 'Camera', 'Code', 'Coffee',
    'Database', 'Files', 'Flag', 'Gift', 'Globe', 'Home', 'Inbox',
    'Layers', 'Mail', 'Map', 'Package', 'Paperclip', 'PenTool',
    'Settings', 'ShoppingCart', 'Users', 'Zap', 'Archive'
}

class SpaceResponse(BaseModel):
    id: uuid.UUID = Field(..., description="Unique identifier (UUID) of the space.")
    name: str = Field(..., min_length=1, max_length=100, description="Name of the space, must be between 1 and 100 characters.")
    icon: Optional[str] = Field('Folder', description="Icon name for the space (Lucide icon name).")
    icon_color: Optional[str] = Field('text-gray-600', description="Tailwind color class for the icon.")
    display_order: Optional[int] = Field(None, description="Display order for sorting spaces.")
    # user_id: uuid.UUID TODO to be deleted later
    created_at: Optional[datetime] = Field(None, description="Timestamp when the space was created, in ISO 8601 format.")
    updated_at: Optional[datetime] = Field(None, description="Timestamp when the space was last updated, in ISO 8601 format.")
    model_config = ConfigDict(from_attributes=True)
        
class CreateSpaceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="The name of the space to create, between 1 and 100 characters.")
    icon: Optional[str] = Field('Folder', description="Icon name for the space (Lucide icon name).")
    icon_color: Optional[str] = Field('text-gray-600', description="Tailwind color class for the icon.")
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "My New Space",
                "icon": "Folder",
                "icon_color": "text-gray-600"
            }
        }
    )

    @field_validator('icon')
    @classmethod
    def validate_icon(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ALLOWED_ICONS:
            raise ValueError(f'Invalid icon name: {v}. Must be one of the allowed Lucide icon names.')
        return v

    @field_validator('icon_color')
    @classmethod
    def validate_icon_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.startswith('text-'):
            raise ValueError('icon_color must be a Tailwind text color class (e.g., text-gray-600)')
        return v

class GetSpacesRequest(BaseModel):
    limit: int = Field(10, ge=1, le=100, description="Number of spaces to return per page, between 1 and 100.")
    offset: int = Field(0, ge=0, description="Number of spaces to skip before starting the page, non-negative.")


class GetSpacesResponseWrapper(BaseModel):
    spaces: List[SpaceResponse] = Field(..., max_length=100, description="List of spaces, up to 100 items per page.")
    pagination: PaginationMetadata = Field(..., description="Pagination metadata including limit, offset, and total count.")

class UpdateSpaceRequest(BaseModel):
        name: Optional[str] = Field(None, min_length=1, max_length=100, description="New name for the space, between 1 and 100 characters.")
        icon: Optional[str] = Field(None, description="Icon name for the space (Lucide icon name).")
        icon_color: Optional[str] = Field(None, description="Tailwind color class for the icon.")
        display_order: Optional[int] = Field(None, description="Display order for sorting spaces.")

        @field_validator('icon')
        @classmethod
        def validate_icon(cls, v: Optional[str]) -> Optional[str]:
            if v is not None and v not in ALLOWED_ICONS:
                raise ValueError(f'Invalid icon name: {v}. Must be one of the allowed Lucide icon names.')
            return v

        @field_validator('icon_color')
        @classmethod
        def validate_icon_color(cls, v: Optional[str]) -> Optional[str]:
            if v is not None and not v.startswith('text-'):
                raise ValueError('icon_color must be a Tailwind text color class (e.g., text-gray-600)')
            return v