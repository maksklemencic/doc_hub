from pydantic import BaseModel, Field

class PaginationMetadata(BaseModel):
    limit: int = Field(..., ge=1, le=100, description="Number of items returned in the current page, between 1 and 100.")
    offset: int = Field(..., ge=0, description="Number of items skipped before the current page, non-negative.")
    total_count: int = Field(..., ge=0, description="Total number of items available for the user.")
