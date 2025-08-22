class VectorStoreError(Exception):
    """Base exception for vector store (Qdrant) errors."""
    pass

class ClientInitializationError(VectorStoreError):
    """Raised when Qdrant client initialization fails."""
    def __init__(self, host: str, port: int, message: str):
        self.host = host
        self.port = port
        self.message = message
        super().__init__(f"Failed to initialize Qdrant client at {host}:{port}: {message}")

class CollectionCreationError(VectorStoreError):
    """Raised when Qdrant collection creation fails."""
    def __init__(self, collection_name: str, message: str):
        self.collection_name = collection_name
        self.message = message
        super().__init__(f"Failed to create collection {collection_name}: {message}")

class UpsertError(VectorStoreError):
    """Raised when Qdrant upsert operation fails."""
    def __init__(self, collection_name: str, message: str):
        self.collection_name = collection_name
        self.message = message
        super().__init__(f"Failed to upsert points to {collection_name}: {message}")

class DeleteError(VectorStoreError):
    """Raised when Qdrant delete operation fails."""
    def __init__(self, collection_name: str, message: str):
        self.collection_name = collection_name
        self.message = message
        super().__init__(f"Failed to delete points from {collection_name}: {message}")

class SearchError(VectorStoreError):
    """Raised when Qdrant search operation fails."""
    def __init__(self, collection_name: str, message: str):
        self.collection_name = collection_name
        self.message = message
        super().__init__(f"Failed to search in {collection_name}: {message}")