import requests
import os
import logging

from ..errors.ollama_errors import LLMConnectionError, LLMRequestError, LLMResponseError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL = os.getenv("LLM_MODEL_NAME", "qwen3:0.6b")

def generate_response(query: str, context: str, stream: bool) -> str:
    
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
    
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": MODEL, "prompt": final_prompt, "stream": stream},
            # timeout=30
        )
        response.raise_for_status()
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Connection error to Ollama at {OLLAMA_URL}: {str(e)}")
        raise LLMConnectionError(OLLAMA_URL, str(e))
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error from Ollama at {OLLAMA_URL}: {str(e)}")
        raise LLMRequestError(OLLAMA_URL, e.response.status_code if e.response else 0, str(e))
    except requests.exceptions.Timeout as e:
        logger.error(f"Timeout error from Ollama at {OLLAMA_URL}: {str(e)}")
        raise LLMConnectionError(OLLAMA_URL, "Request timed out")
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error to Ollama at {OLLAMA_URL}: {str(e)}")
        raise LLMRequestError(OLLAMA_URL, 0, str(e))
    
    
    try:
        response_data = response.json()
        if "response" not in response_data:
            logger.error("Invalid Ollama response: missing 'response' key")
            raise LLMResponseError("Missing 'response' key in JSON response")
        logger.info(f"Generated response for query: {query[:50]}...")
        return response_data["response"], context
    except requests.exceptions.JSONDecodeError as e:
        logger.error(f"Invalid JSON response from Ollama: {str(e)}")
        raise LLMResponseError(f"Invalid JSON response: {str(e)}")