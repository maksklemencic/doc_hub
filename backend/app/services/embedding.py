import numpy as np
from sentence_transformers import SentenceTransformer
from langchain.text_splitter import RecursiveCharacterTextSplitter

model = SentenceTransformer("all-MiniLM-L6-v2")

def chunk_text_recursive(text: str, chunk_size=500, chunk_overlap=50) -> list[str]:
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )
    chunks = text_splitter.split_text(text)
    return chunks

def structure_aware_chunk(text: str, max_length=500, overlap=50) -> list[str]:
    paragraphs = text.split("\n")
    chunks = []
    current_chunk = ""

    for para in paragraphs:
        if not para.strip():
            continue
        if len(current_chunk.split()) + len(para.split()) <= max_length:
            current_chunk += " " + para.strip()
        else:
            chunks.append(current_chunk.strip())
            current_chunk = para.strip()

    if current_chunk:
        chunks.append(current_chunk.strip())

    final_chunks = []
    for i in range(len(chunks)):
        chunk = chunks[i]
        if i > 0:
            prev_chunk = chunks[i - 1].split()
            overlap_text = " ".join(prev_chunk[-overlap:])
            chunk = overlap_text + " " + chunk
        final_chunks.append(chunk)

    return final_chunks

def get_embeddings(chunks: list) -> list:
    return model.encode(chunks)