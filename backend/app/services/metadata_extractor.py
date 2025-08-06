from langdetect import detect
from keybert import KeyBERT
import re

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


def create_metadata(chunks: list[str]) -> list[dict]:
    
    metadata_list = []
    for i, chunk in enumerate(chunks):
        heading = infer_heading_from_context(chunk, chunks[:i])
        lang = detect_language(chunk)
        topics = extract_topics(chunk)

        metadata_list.append({
            "chunk_index": i,
            "language": lang,
            "heading": heading,
            "topics": topics,
            # "page_number": (optional - if you track this in preprocessor)
        })

    return metadata_list