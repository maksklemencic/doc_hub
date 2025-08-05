import numpy as np
from sentence_transformers import SentenceTransformer
from langchain.text_splitter import RecursiveCharacterTextSplitter

model = SentenceTransformer("all-MiniLM-L6-v2")

def chunk_text(text: str, chunk_size=500, chunk_overlap=50) -> list:
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )
    chunks = text_splitter.split_text(text)
    return chunks

def get_embeddings(chunks: list) -> list:
    return model.encode(chunks)