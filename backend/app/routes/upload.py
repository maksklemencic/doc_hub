from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid

from app.services.embedding import chunk_text, get_embeddings
from app.services.qdrant_client import store_document

router = APIRouter()

class DocumentRequest(BaseModel):
    payload: str

@router.post("/text")
def upload_text(data: DocumentRequest):
    try:
        document_id = str(uuid.uuid4())

        chunks = chunk_text(text=data.payload)
        embeddings = get_embeddings(chunks=chunks)

        # Store in vector DB
        store_document(document_id=document_id, embeddings=embeddings, chunks=chunks)

        return {
            "status": "Success",
            "document_id": document_id,
            "chunk_count": len(chunks)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))