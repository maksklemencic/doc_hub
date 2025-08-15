from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import mimetypes
from pydantic import BaseModel
import uuid
import mimetypes
from pathlib import Path

from ..services import db_handler, qdrant_client


router = APIRouter()

class GetDocumentRequest(BaseModel):
    documentId: str


@router.get("/{doc_id}")
def get_document(data: GetDocumentRequest):
    pass

@router.get("/view/{doc_id}")
def view_document(doc_id: str):

    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document ID format")
    
    document = db_handler.get_document_by_id(doc_uuid)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = document.file_path

    mime_type, _ = mimetypes.guess_type(document.filename)
    if not mime_type:
        mime_type = "application/octet-stream"
        
    with open(file_path, "rb") as f:
        data = f.read()

    try:
        return FileResponse(
            path=file_path,
            media_type=mime_type,
            filename=document.filename,
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Error reading file from storage")
    
    
@router.delete("/{doc_id}")
def delete_document_endpoint(doc_id: str):
    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document ID format")
    
    document = db_handler.get_document_by_id(doc_uuid)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # 1. Delete from filesystem
    file_path = Path(document.file_path)
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

    user_folder = file_path.parent
    if user_folder.exists() and not any(user_folder.iterdir()):
        user_folder.rmdir()

    try:
        qdrant_client.delete_document(doc_uuid)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete from vector DB: {str(e)}")

    try:
        db_handler.delete_document(doc_uuid)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete from database: {str(e)}")

    return {"status": "success", "detail": f"Document {doc_id} deleted successfully"}