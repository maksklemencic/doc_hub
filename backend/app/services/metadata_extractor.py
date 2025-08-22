from langdetect import detect
from keybert import KeyBERT
import re
import typing
import uuid
import logging
from typing import Optional, Dict

from ..errors.metadata_extractor_errors import (
    MetadataExtractorError, LanguageDetectionError, TopicExtractionError,
    MetadataCreationError, InvalidInputError
)

logger = logging.getLogger(__name__)
kw_model = KeyBERT()

def detect_language(text: str) -> str:
    if not text or not text.strip():
        logger.warning("Empty or whitespace-only text provided for language detection")
        raise InvalidInputError("text", "Text cannot be empty or whitespace-only")
    
    logger.debug(f"Detecting language for text of length {len(text)}")
    try:
        language = detect(text)
        logger.debug(f"Detected language: {language}")
        return language
    except Exception as e:
        logger.warning(f"Language detection failed: {str(e)}")
        raise LanguageDetectionError(str(e))

def extract_topics(text: str, top_n=3) -> list:
    if not text or not text.strip():
        logger.warning("Empty or whitespace-only text provided for topic extraction")
        raise InvalidInputError("text", "Text cannot be empty or whitespace-only")
    
    if top_n <= 0:
        logger.warning(f"Invalid top_n parameter: {top_n}")
        raise InvalidInputError("top_n", "top_n must be greater than 0")
    
    logger.debug(f"Extracting {top_n} topics from text of length {len(text)}")
    try:
        keywords = kw_model.extract_keywords(text, top_n=top_n)
        topics = [kw[0] for kw in keywords]
        logger.debug(f"Extracted topics: {topics}")
        return topics
    except Exception as e:
        logger.warning(f"Topic extraction failed: {str(e)}")
        raise TopicExtractionError(str(e))

def infer_heading_from_context(chunk: str, previous_lines: list[str]) -> str:
    for line in reversed(previous_lines[-5:]):
        if len(line.strip()) < 100:
            if line.isupper() or re.match(r'^[A-Z][A-Za-z0-9\s\-:]{2,}$', line):
                return line.strip()
    return ""


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
        metadata_list = []
        for i, (chunk, page_number) in enumerate(zip(chunks, page_numbers)):
            try:
                # heading = infer_heading_from_context(chunk, chunks[:i])
                lang = detect_language(chunk)
                topics = extract_topics(chunk)

                metadata_list.append({
                    # "heading": heading,

                    # COMMON FIELDS
                    "chunk_index": i,
                    "language": lang,
                    "topics": topics,
                    "document_id": init_metadata.get('document_id', ''),
                    "mime_type": init_metadata.get('mime_type', ''),
                    "page_number": page_number,
                    "title": init_metadata.get('title', '') if init_metadata else '',
                    "author": init_metadata.get('author', '') if init_metadata else '',
                    "date": init_metadata.get('date', '') if init_metadata else '',
                    
                    # FILE-SPECIFIC FIELDS
                    "filename": init_metadata.get('filename', '') if init_metadata else '',
                    
                    # WEB-SPECIFIC FIELDS
                    "sitename": init_metadata.get('sitename', '') if init_metadata else '',
                    "url": init_metadata.get('url', '') if init_metadata else '',
                })
            except (LanguageDetectionError, TopicExtractionError, InvalidInputError) as e:
                logger.error(f"Failed to process chunk {i}: {str(e)}")
                raise MetadataCreationError(f"Failed to process chunk {i}: {str(e)}")

        logger.info(f"Successfully created metadata for {len(metadata_list)} chunks")
        return metadata_list
    except Exception as e:
        if not isinstance(e, (MetadataCreationError, LanguageDetectionError, TopicExtractionError, InvalidInputError)):
            logger.error(f"Unexpected error during metadata creation: {str(e)}")
            raise MetadataCreationError(f"Metadata creation failed: {str(e)}")
        raise