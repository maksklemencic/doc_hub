from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from pydantic import BaseModel
import uuid

from app.services.embedding import get_embeddings, structure_aware_chunk
from app.services.qdrant_client import store_document
from app.services.document_processor import base64_to_text, extract_text_with_structure
from app.services.metadata_extractor import create_metadata

router = APIRouter()

class Base64UploadRequest(BaseModel):
    filename: str
    file_type: str
    content_base64: str


@router.post("/base64")
def upload_base64(request: Base64UploadRequest):
    try:
        pages = base64_to_text(base64=request.content_base64)
        chunks, document_id = save_to_db(pages, request.filename, request.file_type)

        return {
            "status": "Success",
            "document_id": document_id,
            "document_name": request.filename,
            "chunk_count": len(chunks) 
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/file")
async def upload_file_multipart(   
            file: UploadFile = File(...),
            filename: str = Form(...),
            file_type: str = Form(...),
        ):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only the following file types are supported: pdf")
    try:
        contents = await file.read()        
        pages = extract_text_with_structure(contents)
        chunks, document_id = save_to_db(pages, filename, file_type)

        return {
            "status": "Success",
            "document_id": document_id,
            "document_name": filename,
            "chunk_count": len(chunks)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

def save_to_db(pages: list[(int, str)], filename: str, file_type: str):
    
    chunks, page_numbers = structure_aware_chunk(pages=pages)
    embeddings = get_embeddings(chunks=chunks)
    
    document_id = str(uuid.uuid4())
    metadata = create_metadata(
        chunks=chunks, 
        page_numbers=page_numbers, 
        document_id=document_id,
        filename=filename,
        file_type=file_type
    )
    
    store_document(
        embeddings=embeddings, 
        chunks=chunks, 
        metadata=metadata
    )
    
    return chunks, document_id