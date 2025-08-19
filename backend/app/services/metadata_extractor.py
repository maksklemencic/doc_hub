from langdetect import detect
from keybert import KeyBERT
import re
import typing
import uuid
from typing import Optional, Dict

kw_model = KeyBERT()

def detect_language(text: str) -> str:
    try:
        return detect(text)
    except:
        return "unknown"

def extract_topics(text: str, top_n=3) -> list:
    try:
        keywords = kw_model.extract_keywords(text, top_n=top_n)
        return [kw[0] for kw in keywords]
    except:
        return []

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
    
    metadata_list = []
    for i, (chunk, page_number) in enumerate(zip(chunks, page_numbers)):
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

    return metadata_list