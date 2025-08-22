class LLMError(Exception):
    """Base exception for LLM service (Ollama) errors."""
    pass

class LLMConnectionError(LLMError):
    """Raised when connection to the Ollama server fails."""
    def __init__(self, url: str, message: str):
        self.url = url
        self.message = message
        super().__init__(f"Failed to connect to Ollama at {url}: {message}")

class LLMRequestError(LLMError):
    """Raised when the Ollama API request fails."""
    def __init__(self, url: str, status_code: int, message: str):
        self.url = url
        self.status_code = status_code
        self.message = message
        super().__init__(f"Ollama API request to {url} failed with status {status_code}: {message}")

class LLMResponseError(LLMError):
    """Raised when the Ollama response is invalid."""
    def __init__(self, message: str):
        self.message = message
        super().__init__(f"Invalid Ollama response: {message}")