import logging
import uuid
from typing import Dict

from functools import lru_cache

from keybert import KeyBERT
from langdetect import detect

from ..errors.metadata_extractor_errors import (
    InvalidInputError,
    LanguageDetectionError,
    MetadataCreationError,
    TopicExtractionError,
)

logger = logging.getLogger(__name__)

_kw_model = None

def _get_keybert_model():
    global _kw_model
    if _kw_model is None:
        _kw_model = KeyBERT()
    return _kw_model

@lru_cache(maxsize=128)
def detect_language_cached(text_hash: str, text: str) -> str:
    try:
        language = detect(text)
        logger.debug(f"Detected language: {language}")
        return language
    except Exception as e:
        logger.warning(f"Language detection failed: {str(e)}")
        raise LanguageDetectionError(str(e))

def detect_language(text: str) -> str:
    if not text or not text.strip():
        logger.warning("Empty or whitespace-only text provided for language detection")
        raise InvalidInputError("text", "Text cannot be empty or whitespace-only")
    
    sample_text = text[:500]
    text_hash = str(hash(sample_text))
    
    logger.debug(f"Detecting language for text of length {len(text)}")
    return detect_language_cached(text_hash, sample_text)

def extract_topics(text: str, top_n=3) -> list:
    if not text or not text.strip():
        logger.warning("Empty or whitespace-only text provided for topic extraction")
        raise InvalidInputError("text", "Text cannot be empty or whitespace-only")
    
    if top_n <= 0:
        logger.warning(f"Invalid top_n parameter: {top_n}")
        raise InvalidInputError("top_n", "top_n must be greater than 0")
    
    logger.debug(f"Extracting {top_n} topics from text of length {len(text)}")
    try:
        kw_model = _get_keybert_model()
        keywords = kw_model.extract_keywords(text, top_n=top_n)
        topics = [kw[0] for kw in keywords]
        logger.debug(f"Extracted topics: {topics}")
        return topics
    except Exception as e:
        logger.warning(f"Topic extraction failed: {str(e)}")
        raise TopicExtractionError(str(e))

def extract_document_level_metadata(chunks: list[str]) -> tuple[str, list[str]]:
    combined_sample = " ".join(chunks[:3])[:1000]  # First 3 chunks, max 1000 chars
    
    document_language = detect_language(combined_sample)
    
    topic_sample = " ".join(chunks[:5])[:2000]
    document_topics = extract_topics(topic_sample, top_n=5)
    
    return document_language, document_topics

def create_document_metadata(
    document_id: uuid.UUID,
    filename: str,
    mime_type: str,
    user_id: uuid.UUID,
    space_id: uuid.UUID,
    url: str = "",
    title: str = "",
    author: str = "",
    date: str = "",
    sitename: str = ""
) -> dict:

    return {
        'document_id': str(document_id),
        'filename': filename or "",
        'mime_type': mime_type or "",
        'user_id': str(user_id),
        'space_id': str(space_id),

        'url': url or "",
        'title': title or "",
        'author': author or "",
        'date': date or "",
        'sitename': sitename or "",
    }


def create_metadata_from_chunk_objects(
    chunk_metadata_list: list,
    init_metadata: Dict
) -> list[dict]:
    """
    Create metadata from ChunkMetadata objects with enhanced fields.
    Preserves semantic information from markdown-aware chunking.
    """
    if not chunk_metadata_list:
        logger.warning("Empty chunk_metadata_list provided")
        raise InvalidInputError("chunk_metadata_list", "Chunk metadata list cannot be empty")

    if not init_metadata:
        logger.warning("Empty or None init_metadata provided")
        raise InvalidInputError("init_metadata", "Initial metadata cannot be None or empty")

    logger.info(f"Creating enhanced metadata for {len(chunk_metadata_list)} chunks")

    try:
        # Get language from init_metadata if already detected, otherwise detect from chunks
        document_language = init_metadata.get("language", "unknown")
        if document_language == "unknown":
            # Only detect if not already provided
            chunk_texts = [c.text for c in chunk_metadata_list]
            document_language, document_topics = extract_document_level_metadata(chunk_texts)
        else:
            # Language already detected by agent, just extract topics
            chunk_texts = [c.text for c in chunk_metadata_list]
            topic_sample = " ".join(chunk_texts[:5])[:2000]
            try:
                document_topics = extract_topics(topic_sample, top_n=5)
            except Exception as e:
                logger.warning(f"Topic extraction failed: {str(e)}")
                document_topics = []

        metadata_list = []
        for chunk_meta in chunk_metadata_list:
            try:
                metadata_list.append({
                    # COMMON FIELDS
                    "text": chunk_meta.text,
                    "chunk_index": chunk_meta.chunk_index,
                    "language": document_language,
                    "topics": document_topics,
                    "document_id": init_metadata.get('document_id'),
                    "mime_type": init_metadata.get('mime_type'),
                    "user_id": init_metadata.get('user_id'),
                    "space_id": init_metadata.get('space_id'),
                    "page_number": chunk_meta.page_number,
                    "title": init_metadata.get('title') or '',
                    "author": init_metadata.get('author') or '',
                    "date": init_metadata.get('date') or '',

                    # FILE-SPECIFIC FIELDS
                    "filename": init_metadata.get('filename') or '',

                    # WEB-SPECIFIC FIELDS
                    "sitename": init_metadata.get('sitename') or '',
                    "url": init_metadata.get('url') or '',

                    # ENHANCED FIELDS FROM MARKDOWN CHUNKING
                    "parent_headings": chunk_meta.parent_headings,
                    "section_type": chunk_meta.section_type.value if hasattr(chunk_meta.section_type, 'value') else str(chunk_meta.section_type),
                    "markdown_level": chunk_meta.markdown_level,
                    "content_density_score": chunk_meta.content_density_score,
                    "related_chunk_ids": chunk_meta.related_chunk_ids,
                    "token_count": chunk_meta.token_count,
                    "char_count": chunk_meta.char_count,

                    # PROCESSING METADATA (always present with defaults)
                    "quality_score": init_metadata.get('quality_score', 0.0),
                    "used_vision": init_metadata.get('used_vision', False),
                })
            except Exception as e:
                logger.error(f"Failed to process chunk {chunk_meta.chunk_index}: {str(e)}")
                raise MetadataCreationError(f"Failed to process chunk {chunk_meta.chunk_index}: {str(e)}")

        logger.info(f"Successfully created enhanced metadata for {len(metadata_list)} chunks")
        return metadata_list
    except Exception as e:
        if not isinstance(e, (MetadataCreationError, LanguageDetectionError, TopicExtractionError, InvalidInputError)):
            logger.error(f"Unexpected error during metadata creation: {str(e)}")
            raise MetadataCreationError(f"Metadata creation failed: {str(e)}")
        raise


def create_metadata(
    chunks: list[str],
    page_numbers: list[int],
    init_metadata: Dict
    ) -> list[dict]:
    
    if not chunks:
        logger.warning("Empty chunks list provided for metadata creation")
        raise InvalidInputError("chunks", "Chunks list cannot be empty")
    
    if not page_numbers:
        logger.warning("Empty page_numbers list provided for metadata creation")
        raise InvalidInputError("page_numbers", "Page numbers list cannot be empty")
    
    if len(chunks) != len(page_numbers):
        logger.error(f"Mismatch between chunks ({len(chunks)}) and page_numbers ({len(page_numbers)}) lengths")
        raise InvalidInputError("chunks/page_numbers", "Chunks and page_numbers lists must have the same length")
    
    if not init_metadata:
        logger.warning("Empty or None init_metadata provided")
        raise InvalidInputError("init_metadata", "Initial metadata cannot be None or empty")
    
    logger.info(f"Creating metadata for {len(chunks)} chunks")

    try:
        # Get language from init_metadata if already detected, otherwise detect from chunks
        document_language = init_metadata.get("language", "unknown")
        if document_language == "unknown":
            # Only detect if not already provided
            document_language, document_topics = extract_document_level_metadata(chunks)
        else:
            # Language already provided, just extract topics
            topic_sample = " ".join(chunks[:5])[:2000]
            try:
                document_topics = extract_topics(topic_sample, top_n=5)
            except Exception:
                document_topics = []

        metadata_list = []
        for i, (chunk, page_number) in enumerate(zip(chunks, page_numbers)):
            try:
                metadata_list.append({
                    # COMMON FIELDS
                    "text": chunk,
                    "chunk_index": i,
                    "language": document_language,
                    "topics": document_topics,
                    "document_id": init_metadata.get('document_id'),
                    "mime_type": init_metadata.get('mime_type'),
                    "user_id": init_metadata.get('user_id'),
                    "space_id": init_metadata.get('space_id'),
                    "page_number": page_number,
                    "title": init_metadata.get('title') or '',
                    "author": init_metadata.get('author') or '',
                    "date": init_metadata.get('date') or '',

                    # FILE-SPECIFIC FIELDS
                    "filename": init_metadata.get('filename') or '',

                    # WEB-SPECIFIC FIELDS
                    "sitename": init_metadata.get('sitename') or '',
                    "url": init_metadata.get('url') or '',

                    # PROCESSING METADATA (always present with defaults)
                    "quality_score": init_metadata.get('quality_score', 0.0),
                    "used_vision": init_metadata.get('used_vision', False),
                })
            except Exception as e:
                logger.error(f"Failed to process chunk {i}: {str(e)}")
                raise MetadataCreationError(f"Failed to process chunk {i}: {str(e)}")

        logger.info(f"Successfully created metadata for {len(metadata_list)} chunks")
        return metadata_list
    except Exception as e:
        if not isinstance(e, (MetadataCreationError, LanguageDetectionError, TopicExtractionError, InvalidInputError)):
            logger.error(f"Unexpected error during metadata creation: {str(e)}")
            raise MetadataCreationError(f"Metadata creation failed: {str(e)}")
        raise