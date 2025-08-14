from sentence_transformers import SentenceTransformer
from typing import List, Tuple
import os
from chonkie import RecursiveChunker 


# Configuration
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

model = SentenceTransformer(EMBEDDING_MODEL_NAME)


# def chunk_text_recursive(text: str, chunk_size=500, chunk_overlap=50) -> list[str]:
#     chunker = RecursiveChunker(chunk_size=chunk_size, overlap=chunk_overlap)
#     chunks = chunker(text)
#     return [chunk.text for chunk in chunks]


def chunk_pages_with_recursive_chunker(
    pages: List[Tuple[int, str]],
    chunk_size: int = 500,
    chunk_overlap: int = 50
) -> List[Tuple[int, str]]:
    
    chunker = RecursiveChunker(chunk_size=chunk_size)
    chunks = []
    page_numbers = []

    for page_number, page_text in pages:
        if not page_text.strip():
            continue

        page_chunks = chunker(page_text)
        for chunk in page_chunks:
            chunks.append(chunk.text)
            page_numbers.append(page_number)

    return chunks, page_numbers


# def structure_aware_chunk(pages: List[Tuple[int, str]], max_length=500, overlap=50) -> Tuple[List[str], List[int]]:
#     chunks = []
#     page_numbers = []

#     for page_number, page_text in pages:
#         paragraphs = page_text.split("\n")
#         current_chunk = ""

#         for para in paragraphs:
#             if not para.strip():
#                 continue
#             if len(current_chunk.split()) + len(para.split()) <= max_length:
#                 current_chunk += " " + para.strip()
#             else:
#                 chunks.append(current_chunk.strip())
#                 page_numbers.append(page_number)
#                 current_chunk = para.strip()

#         if current_chunk:
#             chunks.append(current_chunk.strip())
#             page_numbers.append(page_number)

#     final_chunks = []
#     final_pages = []

#     for i in range(len(chunks)):
#         chunk = chunks[i]
#         if i > 0:
#             prev_chunk = chunks[i - 1].split()
#             overlap_text = " ".join(prev_chunk[-overlap:])
#             chunk = overlap_text + " " + chunk

#         final_chunks.append(chunk)
#         final_pages.append(page_numbers[i])

#     return final_chunks, final_pages

def get_embeddings(chunks: list[str]) -> list[list[float]]:
    embeddings = model.encode(chunks, normalize_embeddings=True)
    return embeddings.tolist()