from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
import uuid

from backend.app.services import db_handler
from ...db_init.db_init import User

router = APIRouter()

@router.post("/{space_id}/messages")
def create_message(
    space_id: uuid.UUID,
    content: str,
    user_id: uuid.UUID
):
    try:
        result = db_handler.create_message(content, space_id, user_id)
        if result == "space_not_found_or_unauthorized":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found or not authorized")
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/{space_id}/messages", response_model=List[dict])
def get_space_messages(
    space_id: uuid.UUID,
    user_id: uuid.UUID,
    message_id: Optional[uuid.UUID] = None
):
    try:
        messages = db_handler.get_messages(user_id, space_id, message_id)
        if not messages and message_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        # Check if space exists and is authorized
        space = db_handler.get_space_by_id(space_id, user_id)
        if not space:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found or not authorized")
        return messages
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.patch("/{space_id}/messages/{message_id}", response_model=dict)
def update_message(
    space_id: uuid.UUID,
    message_id: uuid.UUID,
    content: str,
    user_id: uuid.UUID
):
    try:
        result = db_handler.update_message(message_id, space_id, user_id, content)
        if result == "unauthorized":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this message")
        if not result:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.delete("/{space_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(
    space_id: uuid.UUID,
    message_id: uuid.UUID,
    user_id: uuid.UUID
):
    try:
        result = db_handler.delete_message(message_id, space_id, user_id)
        if result == "not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        if result == "unauthorized":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this message")
        return None
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))