from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import mimetypes
from pydantic import BaseModel
import uuid
import mimetypes

from ..services import db_handler


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