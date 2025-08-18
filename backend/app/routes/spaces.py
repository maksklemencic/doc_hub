from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
import uuid

from backend.app.services import db_handler
from ...db_init.db_init import User

router = APIRouter()


@router.post("/")
def create_space(
    name: str,
    user_id: uuid.UUID
):
    try:
        db_space = db_handler.create_space(name, user_id)
        return db_space
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/", response_model=List[dict])  # Using dict for now, can create a Pydantic model later
def get_spaces(
    space_id: Optional[uuid.UUID] = None
):
    if space_id:
        space = db_handler.get_space_by_id(space_id)
        if not space:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
        return [space]
    spaces = db_handler.get_all_spaces()
    return spaces

@router.put("/{space_id}", response_model=dict)  # Using dict for now
def update_space(
    space_id: uuid.UUID,
    name: str
):
    try:
        space = db_handler.update_space(space_id, name)
        if not space:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
        return space
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.delete("/{space_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_space(
    space_id: uuid.UUID
):
    try:
        deleted = db_handler.delete_space(space_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
        return None  # Return None for 204 No Content
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))