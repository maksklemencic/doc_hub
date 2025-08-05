from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from qdrant_client import QdrantClient
from qdrant_client.http.models import Filter, FieldCondition, MatchValue, SearchRequest

router = APIRouter()

class GetDocumentRequest(BaseModel):
    documentId: str

@router.get("/{doc_id}")
def get_document(data: GetDocumentRequest):
    pass