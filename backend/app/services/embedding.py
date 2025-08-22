import logging
import os
from typing import List, Tuple

from chonkie import RecursiveChunker
from sentence_transformers import SentenceTransformer

from ..errors.embedding_errors import ChunkingError, EmbeddingError, InvalidInputError, ModelLoadingError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

try:
    model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    logger.info(f"Loaded SentenceTransformer model: {EMBEDDING_MODEL_NAME}")
except Exception as e:
    logger.error(f"Failed to load SentenceTransformer model {EMBEDDING_MODEL_NAME}: {str(e)}")
    raise ModelLoadingError(EMBEDDING_MODEL_NAME, str(e))


def chunk_pages_with_recursive_chunker(
    pages: List[Tuple[int, str]],
    chunk_size: int = 500,
) -> List[Tuple[int, str]]:
    
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


def get_embeddings(chunks: list[str]) -> list[list[float]]:
    if not isinstance(chunks, list) or not chunks or not all(isinstance(c, str) for c in chunks):
        logger.error("Invalid chunks input: must be a non-empty list of strings")
        raise InvalidInputError("Chunks must be a non-empty list of strings")

    try:
        embeddings = model.encode(chunks, normalize_embeddings=True)
        logger.info(f"Generated embeddings for {len(chunks)} chunks")
        return embeddings.tolist()
    except Exception as e:
        logger.error(f"Failed to generate embeddings: {str(e)}")
        raise EmbeddingError(f"Failed to generate embeddings: {str(e)}")