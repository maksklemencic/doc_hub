class EmbeddingError(Exception):
    """Base exception for embedding-related errors."""
    pass

class ModelLoadingError(EmbeddingError):
    """Raised when the SentenceTransformer model fails to load."""
    def __init__(self, model_name: str, message: str):
        self.model_name = model_name
        self.message = message
        super().__init__(f"Failed to load model {model_name}: {message}")

class ChunkingError(EmbeddingError):
    """Raised when text chunking fails."""
    def __init__(self, message: str):
        self.message = message
        super().__init__(f"Chunking error: {message}")

class InvalidInputError(EmbeddingError):
    """Raised when input data is invalid."""
    def __init__(self, message: str):
        self.message = message
        super().__init__(f"Invalid input: {message}")