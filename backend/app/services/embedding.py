import numpy as np
from sentence_transformers import SentenceTransformer
from typing import List, Tuple, Optional
import os
from pathlib import Path
from model2vec import distill, StaticModel
from chonkie import RecursiveChunker 


# Configuration
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
MODEL_BASE_DIR = os.getenv("MODEL_BASE_DIR", "/app/models")
STATIC_MODEL_PATH = os.path.join(MODEL_BASE_DIR, f"static_embedding_model_{EMBEDDING_MODEL_NAME}")
PCA_DIMS = 256

_static_model: Optional[StaticModel] = None

def get_static_model() -> StaticModel:
    global _static_model
    if _static_model is None:
        _static_model = load_or_distill_model(
            model_path=STATIC_MODEL_PATH,
            source_model=EMBEDDING_MODEL_NAME,
            pca_dims=PCA_DIMS
        )
    return _static_model


def load_or_distill_model(model_path: str, source_model: str, pca_dims: int) -> StaticModel:

    try:
        model_path_obj = Path(model_path)
        
        if model_path_obj.exists() and any(model_path_obj.iterdir()):
            print(f"Loading StaticModel from {model_path}")
            return StaticModel.from_pretrained(model_path)
        else:
            print(f"No model found at {model_path}. Distilling new model from {source_model}")
            
            # Ensure directory exists
            model_path_obj.mkdir(parents=True, exist_ok=True)
            
            # Load source model and distill
            st_model = SentenceTransformer(source_model)
            static_model = distill(st_model, pca_dims=pca_dims)
            
            # Save the distilled model
            static_model.save(model_path)
            print(f"Model distilled and saved to {model_path}")
            return static_model
            
    except Exception as e:
        print(f"Error loading or distilling model: {e}")
        raise


def chunk_text_recursive(text: str, chunk_size=500, chunk_overlap=50) -> list[str]:
    chunker = RecursiveChunker(chunk_size=chunk_size, overlap=chunk_overlap)
    chunks = chunker(text)
    return [chunk.text for chunk in chunks]

def structure_aware_chunk(pages: List[Tuple[int, str]], max_length=500, overlap=50) -> Tuple[List[str], List[int]]:
    chunks = []
    page_numbers = []

    for page_number, page_text in pages:
        paragraphs = page_text.split("\n")
        current_chunk = ""

        for para in paragraphs:
            if not para.strip():
                continue
            if len(current_chunk.split()) + len(para.split()) <= max_length:
                current_chunk += " " + para.strip()
            else:
                chunks.append(current_chunk.strip())
                page_numbers.append(page_number)
                current_chunk = para.strip()

        if current_chunk:
            chunks.append(current_chunk.strip())
            page_numbers.append(page_number)

    final_chunks = []
    final_pages = []

    for i in range(len(chunks)):
        chunk = chunks[i]
        if i > 0:
            prev_chunk = chunks[i - 1].split()
            overlap_text = " ".join(prev_chunk[-overlap:])
            chunk = overlap_text + " " + chunk

        final_chunks.append(chunk)
        final_pages.append(page_numbers[i])

    return final_chunks, final_pages

def get_embeddings(chunks: list) -> list:
    model = get_static_model()
    embeddings = model.encode(chunks)
    return embeddings.tolist()