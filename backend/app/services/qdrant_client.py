import logging
import uuid
from typing import List, Optional

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from qdrant_client.http.models import Distance, PointStruct, VectorParams

from ..errors.qdrant_errors import (
    ClientInitializationError, CollectionCreationError, DeleteError,
    SearchError, UpsertError
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    client = QdrantClient(host="qdrant", port=6333)
    logger.info("Initialized Qdrant client at qdrant:6333")
except Exception as e:
    logger.error(f"Failed to initialize Qdrant client: {str(e)}")
    client = None
    # Don't raise error, just log it

COLLECTION_NAME = "documents"

def _check_client_available():
    """Check if Qdrant client is available and raise error if not."""
    if not client:
        raise SearchError("Qdrant", "Qdrant client not available - check installation and connection")

def ensure_collection():
    _check_client_available()
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
    _check_client_available()
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
    _check_client_available()
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
        logger.error(
            f"Failed to delete document {doc_id} from {COLLECTION_NAME}: {str(e)}"
        )
        raise DeleteError(COLLECTION_NAME, str(e))

def query_top_k(
    query_vector,
    user_id: uuid.UUID,
    space_id: uuid.UUID,
    document_ids: Optional[List[uuid.UUID]] = None,
    k: int = 5
):
    _check_client_available()
    try:
        ensure_collection()
        must_filters = [
            qmodels.FieldCondition(
                key="user_id",
                match=qmodels.MatchValue(value=str(user_id))
            ),
            qmodels.FieldCondition(
                key="space_id",
                match=qmodels.MatchValue(value=str(space_id))
            )
        ]
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
        logger.info(
            f"Retrieved {len(results)} results for query in collection "
            f"{COLLECTION_NAME}"
        )
        return results
    except Exception as e:
        logger.error(f"Failed to search in {COLLECTION_NAME}: {str(e)}")
        raise SearchError(COLLECTION_NAME, str(e))

def get_document_chunks(
    document_id: uuid.UUID,
    user_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0
):
    """Get all chunks for a specific document with pagination."""
    _check_client_available()
    try:
        ensure_collection()
        
        # First get the total count
        count_result = client.count(
            collection_name=COLLECTION_NAME,
            count_filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="document_id",
                        match=qmodels.MatchValue(value=str(document_id))
                    ),
                    qmodels.FieldCondition(
                        key="user_id",
                        match=qmodels.MatchValue(value=str(user_id))
                    )
                ]
            )
        )
        total_count = count_result.count
        
        # Get the chunks with pagination, ordered by chunk_index
        results = client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="document_id",
                        match=qmodels.MatchValue(value=str(document_id))
                    ),
                    qmodels.FieldCondition(
                        key="user_id",
                        match=qmodels.MatchValue(value=str(user_id))
                    )
                ]
            ),
            limit=limit,
            offset=offset,
            with_payload=True,
            with_vectors=False  # We don't need vectors for this operation
        )
        
        # Sort by chunk_index to maintain document order
        chunks = sorted(results[0], key=lambda x: x.payload.get('chunk_index', 0))
        
        logger.info(
            f"Retrieved {len(chunks)} chunks for document {document_id} "
            f"(total: {total_count})"
        )
        return chunks, total_count
    except Exception as e:
        logger.error(f"Failed to get chunks for document {document_id}: {str(e)}")
        raise SearchError(COLLECTION_NAME, str(e))


def search_documents(
    query_embedding: List[float],
    top_k: int,
    filter_dict: Optional[dict] = None
) -> List[dict]:
    """
    Search for documents using vector similarity.

    Args:
        query_embedding: Query vector embedding
        top_k: Number of results to return
        filter_dict: Optional filters to apply

    Returns:
        List of search results with text, score, and metadata
    """
    _check_client_available()
    try:
        ensure_collection()

        # Build query filter
        must_filters = []
        if filter_dict:
            for key, value in filter_dict.items():
                must_filters.append(
                    qmodels.FieldCondition(
                        key=key,
                        match=qmodels.MatchValue(value=str(value))
                    )
                )

        query_filter = None
        if must_filters:
            query_filter = qmodels.Filter(must=must_filters)

        # Perform search
        results = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_embedding,
            limit=top_k,
            with_payload=True,
            query_filter=query_filter
        )

        # Process results to match expected format
        processed_results = []
        for result in results:
            processed_result = {
                "text": result.payload.get("text", ""),
                "score": result.score,
                "metadata": {k: v for k, v in result.payload.items() if k != "text"}
            }
            processed_results.append(processed_result)

        logger.info(f"Found {len(processed_results)} search results")
        return processed_results

    except Exception as e:
        logger.error(f"Search failed: {str(e)}")
        raise SearchError(COLLECTION_NAME, str(e))