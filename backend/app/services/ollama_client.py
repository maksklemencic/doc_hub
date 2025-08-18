import requests
import os

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL = os.getenv("LLM_MODEL_NAME", "qwen3:0.6b")

def generate_response(query: str, context: str, stream: bool) -> str:
    
    # promt = f"""Instruction: Use the context to answer the question. If there is no sufficient information in context, use your knowledge.
    # Question: {query}
    # Context: {context}"""
    
    prompt_template = """<|im_start|>system
You are a highly knowledgeable and accurate RAG system. Your primary goal is to provide concise and comprehensive answers to user questions based on the provided context. Follow these rules precisely:
1.  **Prioritize the Context:** Your answer must be based *exclusively* on the information found in the `<context>` section. Do not use any external knowledge.
2.  **No Sufficient Information:** If the `<context>` does not contain the answer, you must respond with a specific phrase indicating this, such as "I'm sorry, I cannot answer this question with the provided context." or "The provided context does not contain sufficient information to answer the question."
3.  **Synthesize and Summarize:** If the answer is present, synthesize the relevant information from the context into a clear, direct, and well-structured response.
4.  **Stay on Topic:** Your answer should directly address the user's question and avoid adding any unrelated details.

<|im_end|>
<|im_start|>user
<context>
{context}
</context>
<query>
{query}
</query>
<|im_end|>"""

    final_prompt = prompt_template.format(context=context, query=query)
    
    response = requests.post(f"{OLLAMA_URL}/api/generate", json={
        "model": MODEL,
        "prompt": final_prompt,
        "stream": stream
    })
    response.raise_for_status()
    return response.json()["response"], context