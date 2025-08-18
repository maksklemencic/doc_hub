from qdrant_client import QdrantClient
from qdrant_client.http.models import VectorParams, Distance, PointStruct
from qdrant_client.http import models as qmodels
import uuid
from typing import Optional, List

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

def query_top_k(query_vector, user_id: uuid.UUID, space_id: Optional[uuid.UUID] = None, document_ids: Optional[List[uuid.UUID]] = None, k=5):
    ensure_collection()
    
    must_filters = [
        qmodels.FieldCondition(
            key="user_id",
            match=qmodels.MatchValue(value=str(user_id))
        )
    ]

    if space_id:
        must_filters.append(
            qmodels.FieldCondition(
                key="space_id",
                match=qmodels.MatchValue(value=str(space_id))
            )
        )

    if document_ids:
        must_filters.append(
            qmodels.FieldCondition(
                key="document_id",
                match=qmodels.MatchAny(any=[str(doc_id) for doc_id in document_ids])
            )
        )

    results = client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=k,
        with_payload=True,
        query_filter=qmodels.Filter(
            must=must_filters
        )
    )
    return results  # Each result has `.payload` and `.score`