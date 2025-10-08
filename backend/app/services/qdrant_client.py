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
                payload={
                    "text": chunk,
                    "document_id": str(item_metadata.get("document_id")),
                    **{k: v for k, v in item_metadata.items() if k != "document_id"}
                }
            )
            for embedding, chunk, item_metadata in zip(embeddings, chunks, metadata)
        ]
        logger.debug(f"Storing {len(points)} points. Example payload: {points[0].payload if points else 'N/A'}")
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
    logger.info(f"query_top_k called with:")
    logger.info(f"  - user_id: {user_id}")
    logger.info(f"  - space_id: {space_id}")
    logger.info(f"  - document_ids: {document_ids} (type: {type(document_ids)})")
    logger.info(f"  - k: {k}")
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

        # Check if document_ids filter should be added
        if document_ids:
            doc_id_strings = [str(doc_id) for doc_id in document_ids]
            logger.info(f"Adding document_id filter with values: {doc_id_strings}")
            must_filters.append(
                qmodels.FieldCondition(
                    key="document_id",
                    match=qmodels.MatchAny(any=doc_id_strings)
                )
            )
        else:
            logger.info(f"No document_id filter added (document_ids is {document_ids})")

        logger.info(f"Final filter structure: {must_filters}")

        results = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            limit=k,
            with_payload=True,
            query_filter=qmodels.Filter(must=must_filters)
        )

        result_doc_ids = [res.payload.get('document_id') for res in results]
        logger.info(f"Search returned {len(results)} results from document_ids: {result_doc_ids}")

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
                # Special handling for document_ids (list of IDs)
                if key == "document_ids" and isinstance(value, list):
                    if value:  # Only add filter if list is not empty
                        logger.info(f"Adding document_ids filter: {value}")
                        must_filters.append(
                            qmodels.FieldCondition(
                                key="document_id",
                                match=qmodels.MatchAny(any=[str(doc_id) for doc_id in value])
                            )
                        )
                else:
                    # Standard single-value filter
                    must_filters.append(
                        qmodels.FieldCondition(
                            key=key,
                            match=qmodels.MatchValue(value=str(value))
                        )
                    )

        logger.info(f"search_documents filter structure: {must_filters}")

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
        result_doc_ids = set()
        for result in results:
            result_doc_ids.add(result.payload.get("document_id"))
            processed_result = {
                "text": result.payload.get("text", ""),
                "score": result.score,
                "metadata": {k: v for k, v in result.payload.items() if k != "text"}
            }
            processed_results.append(processed_result)

        logger.info(f"search_documents found {len(processed_results)} results from document_ids: {result_doc_ids}")
        return processed_results

    except Exception as e:
        logger.error(f"Search failed: {str(e)}")
        raise SearchError(COLLECTION_NAME, str(e))