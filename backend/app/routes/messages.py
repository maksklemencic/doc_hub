from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
import uuid
from pydantic import BaseModel

from backend.app.services import db_handler
# from ...db_init.db_init import User

router = APIRouter()

class CreateMessageRequest(BaseModel):
    content: str
    user_id: uuid.UUID
    
class GetMessagesRequest(BaseModel):
    user_id: uuid.UUID
    message_id: Optional[uuid.UUID] = None
    
class DeleteMessageRequest(BaseModel):
    user_id: uuid.UUID

@router.post("/{space_id}/messages")
def create_message(request: CreateMessageRequest, space_id: uuid.UUID):
    try:
        result = db_handler.create_message(request.content, space_id, request.user_id)
        if result == "space_not_found_or_unauthorized":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found or not authorized")
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/{space_id}/messages")
def get_space_messages(request: GetMessagesRequest, space_id: uuid.UUID):
    try:
        if request.message_id is None:
            messages = db_handler.get_messages(request.user_id, space_id)
        else:
            messages = db_handler.get_messages(request.message_id, request.user_id, space_id)
        return messages
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/{space_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(request: DeleteMessageRequest, space_id: uuid.UUID, message_id: uuid.UUID):
    try:
        result = db_handler.delete_message(message_id, space_id, request.user_id)
        if result == "not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        if result == "unauthorized":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this message")
        return None
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))