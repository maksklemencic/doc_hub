import app.services.embedding
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.ollama_client import generate_response
from app.services.embedding import get_embeddings
from app.services.qdrant_client import query_top_k

router = APIRouter()

class QueryRequest(BaseModel):
    query: str
    stream: bool = False
    top_k: int = 5

@router.post("/query")
def create_query(data: QueryRequest):
    try:
        # Step 1: Embed the user's query
        query_embedding = get_embeddings([data.query])[0]
        
        # Step 2: Search for top-k relevant chunks in Qdrant
        top_k_chunks = query_top_k(query_embedding, k=data.top_k)
        
        # Step 3: Build context from payloads
        context = "\n".join([res.payload["text"] for res in top_k_chunks])
        
        # Step 4: Call Ollama to get response
        response = generate_response(query=data.query, context=context, stream=data.stream)

        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))