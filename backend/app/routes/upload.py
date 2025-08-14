from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from pydantic import BaseModel
import uuid

from ..services import embedding, qdrant_client, metadata_extractor, document_processor, file_service, db_handler

router = APIRouter()

class Base64UploadRequest(BaseModel):
    filename: str
    mime_type: str
    content_base64: str
    user_id: uuid.UUID


@router.post("/base64")
def upload_base64(request: Base64UploadRequest):
    try:
        pages = document_processor.base64_to_text(base64_text=request.content_base64, mime_type=request.mime_type)
        chunks, document_id = save_to_vector_db(pages, request.filename, request.mime_type)
        
        saved_file_path = file_service.save_base64_file(request.content_base64, request.filename, request.user_id)
        
        doc_id = db_handler.add_document(
            filename=request.filename,
            file_path=saved_file_path,
            mime_type=request.mime_type,
            uploaded_by=request.user_id
        )

        return {
            "status": "Success",
            "doc_vector_id": document_id,
            "doc_id": doc_id,
            "document_name": request.filename,
            "chunk_count": len(chunks),
            "save_path": saved_file_path
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/file")
async def upload_file_multipart(   
            file: UploadFile = File(...),
            user_id: uuid.UUID = Form(...)
        ):
    try:
        contents = await file.read()        
        pages = document_processor.process_document_for_text(contents, file.content_type)
        chunks, document_id = save_to_vector_db(pages, file.filename, file.content_type)
        
        saved_file_path = file_service.save_file(file, user_id)
        
        doc_id = db_handler.add_document(
            filename=file.filename,
            file_path=saved_file_path,
            mime_type=file.content_type,
            uploaded_by=user_id
        )

        return {
            "status": "Success",
            "doc_vector_id": document_id,
            "doc_id": doc_id,
            "document_name": file.filename,
            "chunk_count": len(chunks),
            "save_path": saved_file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

def save_to_vector_db(pages: list[(int, str)], filename: str, mime_type: str):
    
    # chunks, page_numbers = structure_aware_chunk(pages=pages)
    chunks, page_numbers = embedding.chunk_pages_with_recursive_chunker(pages=pages)
    embeddings = embedding.get_embeddings(chunks=chunks)
    
    document_id = str(uuid.uuid4())
    metadata = metadata_extractor.create_metadata(
        chunks=chunks, 
        page_numbers=page_numbers, 
        doc_id=document_id,
        filename=filename,
        mime_type=mime_type
    )
    
    qdrant_client.store_document(
        embeddings=embeddings, 
        chunks=chunks, 
        metadata=metadata
    )
    
    return chunks, document_id