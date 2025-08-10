from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class GetDocumentRequest(BaseModel):
    documentId: str

@router.get("/{doc_id}")
def get_document(data: GetDocumentRequest):
    pass