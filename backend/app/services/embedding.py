import logging
import os
from typing import List, Tuple, Optional, Dict, Any

from chonkie import RecursiveChunker
from sentence_transformers import SentenceTransformer

from ..errors.embedding_errors import ChunkingError, EmbeddingError, InvalidInputError, ModelLoadingError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration - Updated for multilingual support
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "paraphrase-multilingual-MiniLM-L12-v2")
EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "384"))

# Initialize model
try:
    model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    logger.info(
        f"Loaded multilingual SentenceTransformer model: {EMBEDDING_MODEL_NAME} "
        f"(dimension: {EMBEDDING_DIMENSION})"
    )

    # Verify model dimension matches expected
    test_embedding = model.encode(["test"], normalize_embeddings=True)
    actual_dimension = test_embedding.shape[1]
    if actual_dimension != EMBEDDING_DIMENSION:
        logger.warning(
            f"Model dimension {actual_dimension} does not match expected {EMBEDDING_DIMENSION}"
        )
        EMBEDDING_DIMENSION = actual_dimension

except Exception as e:
    logger.error(f"Failed to load multilingual model {EMBEDDING_MODEL_NAME}: {str(e)}")
    model = None
    # Don't raise error, just log it


def chunk_pages_with_recursive_chunker(
    pages: List[Tuple[int, str]],
    chunk_size: int = 500,
) -> Tuple[List[str], List[int]]:

    try:
        chunker = RecursiveChunker(chunk_size=chunk_size)
    except Exception as e:
        logger.error(f"Failed to initialize RecursiveChunker: {str(e)}")
        raise ChunkingError(f"Failed to initialize chunker: {str(e)}")
    
    chunks = []
    page_numbers = []

    for page_number, page_text in pages:
        if not page_text.strip():
            logger.debug(f"Skipping empty page {page_number}")
            continue

        try:
            page_chunks = chunker(page_text)
            for chunk in page_chunks:
                chunks.append(chunk.text)
                page_numbers.append(page_number)
        except Exception as e:
            logger.error(f"Failed to chunk page {page_number}: {str(e)}")
            raise ChunkingError(f"Failed to chunk page {page_number}: {str(e)}")

    logger.info(f"Generated {len(chunks)} chunks from {len(pages)} pages")
    return chunks, page_numbers


def get_embeddings(chunks: list[str], language: str | None = None) -> list[list[float]]:
    """Generate multilingual embeddings for text chunks.

    Args:
        chunks: List of text chunks to embed
        language: Optional language hint for optimization

    Returns:
        List of embedding vectors
    """
    if not isinstance(chunks, list) or not chunks or not all(isinstance(c, str) for c in chunks):
        logger.error("Invalid chunks input: must be a non-empty list of strings")
        raise InvalidInputError("Chunks must be a non-empty list of strings")

    if not model:
        logger.error("SentenceTransformer model not available")
        raise EmbeddingError("Embedding model not available - check installation")

    try:
        # Use multilingual model with normalization
        embeddings = model.encode(
            chunks,
            normalize_embeddings=True,
            batch_size=32,  # Optimize batch size for multilingual model
            show_progress_bar=len(chunks) > 50  # Show progress for large batches
        )

        logger.info(
            f"Generated multilingual embeddings for {len(chunks)} chunks "
            f"(dimension: {embeddings.shape[1]}, language: {language or 'auto'})"
        )

        return embeddings.tolist()
    except Exception as e:
        logger.error(f"Failed to generate multilingual embeddings: {str(e)}")
        raise EmbeddingError(f"Failed to generate multilingual embeddings: {str(e)}")


def get_query_embedding(query: str, language: str | None = None) -> List[float]:
    """Generate embedding for a single query string.

    Args:
        query: Query string to embed
        language: Optional language hint for optimization

    Returns:
        Single embedding vector
    """
    if not isinstance(query, str) or not query.strip():
        logger.error("Invalid query input: must be a non-empty string")
        raise InvalidInputError("Query must be a non-empty string")

    if not model:
        logger.error("SentenceTransformer model not available")
        raise EmbeddingError("Embedding model not available - check installation")

    try:
        embedding = model.encode(
            [query],
            normalize_embeddings=True
        )

        logger.debug(
            f"Generated query embedding (dimension: {embedding.shape[1]}, "
            f"language: {language or 'auto'})"
        )

        return embedding[0].tolist()
    except Exception as e:
        logger.error(f"Failed to generate query embedding: {str(e)}")
        raise EmbeddingError(f"Failed to generate query embedding: {str(e)}")


def get_model_info() -> Dict[str, Any]:
    """Get information about the current embedding model.

    Returns:
        Dictionary with model information
    """
    return {
        "model_name": EMBEDDING_MODEL_NAME,
        "dimension": EMBEDDING_DIMENSION,
        "multilingual": True,
        "supports_languages": [
            "en", "de", "fr", "es", "it", "pt", "ru", "zh", "ja", "ko",
            "ar", "hi", "th", "tr", "pl", "nl", "sv", "da", "no", "fi"
        ],  # Common languages supported by multilingual MiniLM
        "max_sequence_length": 512
    }