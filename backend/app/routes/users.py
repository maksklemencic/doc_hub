from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import uuid

from ..services import db_handler

router = APIRouter()

class CreateUserRequest(BaseModel):
    email: str
    first_name: str
    last_name: str

@router.post("/")
def create_user(request: CreateUserRequest):
    try:
        db_user = db_handler.create_user(
            email=request.email,
            first_name=request.first_name,
            last_name=request.last_name
        )
        return db_user
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    

@router.get("/{user_id}")
def get_user(user_id: uuid.UUID):
    user = db_handler.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.delete("/{user_id}")
def delete_user(user_id: uuid.UUID):
    try:
        deleted = db_handler.delete_user(user_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return {"detail": "User deleted successfully"}
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))