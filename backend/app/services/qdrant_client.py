import app.services.embedding
from qdrant_client import QdrantClient
from qdrant_client.http.models import VectorParams, Distance, PointStruct
import uuid

client = QdrantClient(host="qdrant", port=6333)

COLLECTION_NAME = "documents"

def ensure_collection():
    if COLLECTION_NAME not in [c.name for c in client.get_collections().collections]:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE)
        )

def store_document(document_id: str, chunks: list, embeddings: list):
    ensure_collection()
    
    document_metadata = {
        "document_name": "example.txt",
        "document_type": "text",
        "title": "Slovenia",
        "author": "Unknown",
        "language": "en",
        "topics": ["country", "Slovenia"]
    }
    
    client.upsert(
        collection_name=COLLECTION_NAME,
        points=[
            PointStruct(
                id=str(uuid.uuid4()),
                vector=embedding,
                payload={
                    "document_id": document_id,
                    "text": chunk,
                    "chunk_index": i,
                    **document_metadata
                }
            )
            # for i, (embedding, metadata_dict[0]) in enumerate(zip(embeddings, metadatas))
            for i, (embedding, chunk) in enumerate(zip(embeddings, chunks))
        ]
    )
    
def query_top_k(query_vector, k=5):
    ensure_collection()
    
    results = client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=k,
        with_payload=True,
    )
    return results  # Each result has `.payload` and `.score`