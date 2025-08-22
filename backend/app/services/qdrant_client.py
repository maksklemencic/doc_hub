from qdrant_client import QdrantClient
from qdrant_client.http.models import VectorParams, Distance, PointStruct
from qdrant_client.http import models as qmodels
import uuid
from typing import Optional, List
import logging

from backend.app.errors.qdrant_errors import ClientInitializationError, CollectionCreationError, UpsertError, DeleteError, SearchError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    client = QdrantClient(host="qdrant", port=6333)
    logger.info("Initialized Qdrant client at qdrant:6333")
except Exception as e:
    logger.error(f"Failed to initialize Qdrant client: {str(e)}")
    raise ClientInitializationError("qdrant", 6333, str(e))

COLLECTION_NAME = "documents"

def ensure_collection():
    try:
        collections = client.get_collections().collections
        if COLLECTION_NAME not in [c.name for c in collections]:
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=384, distance=Distance.COSINE)
            )
            logger.info(f"Created Qdrant collection: {COLLECTION_NAME}")
    except Exception as e:
        logger.error(f"Failed to create collection {COLLECTION_NAME}: {str(e)}")
        raise CollectionCreationError(COLLECTION_NAME, str(e))

def store_document(
        chunks: list, 
        embeddings: list, 
        metadata: list[dict],
    ):
    # if not isinstance(chunks, list) or not isinstance(embeddings, list) or not isinstance(metadata, list):
    #     logger.error("Invalid input: chunks, embeddings, and metadata must be lists")
    #     raise InvalidInputError("Chunks, embeddings, and metadata must be lists")
    
    # if not chunks or len(chunks) != len(embeddings) or len(chunks) != len(metadata):
    #     logger.error(f"Input length mismatch: chunks ({len(chunks)}), embeddings ({len(embeddings)}), metadata ({len(metadata)})")
    #     raise InvalidInputError("Chunks, embeddings, and metadata must have equal non-zero lengths")
    
    # for i, (chunk, embedding, meta) in enumerate(zip(chunks, embeddings, metadata)):
    #     if not isinstance(chunk, str) or not isinstance(embedding, list) or not isinstance(meta, dict):
    #         logger.error(f"Invalid input at index {i}: chunk must be str, embedding must be list, metadata must be dict")
    #         raise InvalidInputError(f"Invalid input at index {i}: chunk must be str, embedding must be list, metadata must be dict")
    #     if not all(isinstance(x, (int, float)) for x in embedding):
    #         logger.error(f"Invalid embedding at index {i}: must be a list of numbers")
    #         raise InvalidInputError(f"Invalid embedding at index {i}: must be a list of numbers")
    try:
        ensure_collection()
        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=embedding,
                payload={"text": chunk, **item_metadata}
            )
            for embedding, chunk, item_metadata in zip(embeddings, chunks, metadata)
        ]
        client.upsert(collection_name=COLLECTION_NAME, points=points)
        logger.info(f"Upserted {len(points)} points to collection {COLLECTION_NAME}")
    except Exception as e:
        logger.error(f"Failed to upsert points to {COLLECTION_NAME}: {str(e)}")
        raise UpsertError(COLLECTION_NAME, str(e))

def delete_document(doc_id: uuid.UUID):
    try:
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
        logger.info(f"Deleted document {doc_id} from collection {COLLECTION_NAME}")
    except Exception as e:
        logger.error(f"Failed to delete document {doc_id} from {COLLECTION_NAME}: {str(e)}")
        raise DeleteError(COLLECTION_NAME, str(e))

def query_top_k(query_vector, user_id: uuid.UUID, space_id: Optional[uuid.UUID] = None, document_ids: Optional[List[uuid.UUID]] = None, k=5):
    # if not isinstance(query_vector, list) or not all(isinstance(x, (int, float)) for x in query_vector):
    #     logger.error("Invalid query_vector: must be a list of numbers")
    #     raise InvalidInputError("query_vector must be a list of numbers")
    # if len(query_vector) != 384:
    #     logger.error(f"Invalid query_vector dimension: {len(query_vector)}, expected 384")
    #     raise InvalidInputError(f"query_vector must have dimension 384")
    # if not isinstance(k, int) or k <= 0:
    #     logger.error(f"Invalid k: {k} must be a positive integer")
    #     raise InvalidInputError("k must be a positive integer")
    
    try:
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
            query_filter=qmodels.Filter(must=must_filters)
        )
        logger.info(f"Retrieved {len(results)} results for query in collection {COLLECTION_NAME}")
        return results
    except Exception as e:
        logger.error(f"Failed to search in {COLLECTION_NAME}: {str(e)}")
        raise SearchError(COLLECTION_NAME, str(e))