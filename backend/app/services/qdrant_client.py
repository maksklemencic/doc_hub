from qdrant_client import QdrantClient
from qdrant_client.http.models import VectorParams, Distance, PointStruct
from qdrant_client.http import models as qmodels
import uuid

client = QdrantClient(host="qdrant", port=6333)

COLLECTION_NAME = "documents"

def ensure_collection():
    if COLLECTION_NAME not in [c.name for c in client.get_collections().collections]:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE)
        )

def store_document(
        chunks: list, 
        embeddings: list, 
        metadata: list[dict],
    ):
    ensure_collection()
    
    client.upsert(
        collection_name=COLLECTION_NAME,
        points=[
            PointStruct(
                id=str(uuid.uuid4()),
                vector=embedding,
                payload={
                    "text": chunk,
                    **item_metadata
                }
            )
            for i, (embedding, chunk, item_metadata) in enumerate(zip(embeddings, chunks, metadata))
        ]
    )

def delete_document(doc_id: uuid.UUID):
    ensure_collection()

    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=qmodels.FilterSelector(
            filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="document_id",
                        match=qmodels.MatchValue(value=str(doc_id))
                    )
                ]
            )
        )
        
    )

def query_top_k(query_vector, user_id, k=5):
    ensure_collection()
    
    # TODO Use metadata to better search
    results = client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=k,
        with_payload=True,
        # query_filter={
        #     "must": [
        #         {"key": "user_id", "match": {"value": user_id}}
        #     ]
        # }
    )
    return results  # Each result has `.payload` and `.score`