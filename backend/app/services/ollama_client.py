import requests
import os

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL = os.getenv("LLM_MODEL_NAME", "qwen3:0.6b")

def generate_response(query: str, context: str, stream: bool) -> str:
    
    promt = f"""Instruction: Use the context to answer the question. If there is no sufficient information in context, use your knowledge.
    Question: {query}
    Context: {context}"""
    
    response = requests.post(f"{OLLAMA_URL}/api/generate", json={
        "model": MODEL,
        "prompt": promt,
        "stream": stream
    })
    response.raise_for_status()
    return response.json()["response"]