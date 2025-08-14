from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from pydantic import BaseModel
import uuid

from ..services.embedding import get_embeddings, chunk_pages_with_recursive_chunker
from ..services.qdrant_client import store_document
from ..services.metadata_extractor import create_metadata
from ..services.document_processor import base64_to_text, process_document_for_text

router = APIRouter()

class Base64UploadRequest(BaseModel):
    filename: str
    file_type: str
    content_base64: str


@router.post("/base64")
def upload_base64(request: Base64UploadRequest):
    try:
        pages = base64_to_text(base64_text=request.content_base64, file_type=request.file_type)
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
    try:
        contents = await file.read()        
        pages = process_document_for_text(contents, file_type)
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
    
    # chunks, page_numbers = structure_aware_chunk(pages=pages)
    chunks, page_numbers = chunk_pages_with_recursive_chunker(pages=pages)
    embeddings = get_embeddings(chunks=chunks)
    
    document_id = str(uuid.uuid4())
    metadata = create_metadata(
        chunks=chunks, 
        page_numbers=page_numbers, 
        doc_id=document_id,
        filename=filename,
        file_type=file_type
    )
    
    store_document(
        embeddings=embeddings, 
        chunks=chunks, 
        metadata=metadata
    )
    
    return chunks, document_id