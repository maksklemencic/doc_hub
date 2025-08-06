import app.services.embedding
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.ollama_client import generate_response
from app.services.embedding import get_embeddings
from app.services.qdrant_client import query_top_k

router = APIRouter()

class PostQueryRequest(BaseModel):
    query: str
    stream: bool = False
    top_k: int = 5

@router.post("/query/{user_id}")
def create_query(data: PostQueryRequest, user_id: str):
    try:
        if user_id is None:
            raise HTTPException(status_code=404, detail="No user_id provided!")
        
        query_embedding = get_embeddings([data.query])[0]
        
        top_k_chunks = query_top_k(query_embedding, user_id=user_id, k=data.top_k)
        context = "\n".join([res.payload["text"] for res in top_k_chunks])
        
        response = generate_response(query=data.query, context=context, stream=data.stream)

        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))