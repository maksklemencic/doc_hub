import numpy as np
from sentence_transformers import SentenceTransformer
from langchain.text_splitter import RecursiveCharacterTextSplitter
import os

print("Testing...")
model = SentenceTransformer("all-MiniLM-L6-v2")

def chunk_text(text: str, chunk_size=500, chunk_overlap=50):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )
    chunks = text_splitter.split_text(text)
    return chunks


def get_embeddings(chunks: list) -> list:
    return model.encode(chunks)


with open("./backend/app/debug/document_sample.txt", "r", encoding="utf-8") as f:
    text = f.read()
    
chunks = chunk_text(text)
print(f"Total chunks created: {len(chunks)}")
# print(chunks[0])

embeddings = get_embeddings(chunks)
# list (125, 384)

print("Done")