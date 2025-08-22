class MetadataExtractorError(Exception):
    """Base exception for metadata extraction errors."""
    def __init__(self, message: str, code: str = "metadata_extractor_error"):
        self.message = message
        self.code = code
        super().__init__(message)

class LanguageDetectionError(MetadataExtractorError):
    """Raised when language detection fails."""
    def __init__(self, error_detail: str):
        self.error_detail = error_detail
        message = f"Language detection failed: {error_detail}"
        super().__init__(message, "language_detection_error")

class TopicExtractionError(MetadataExtractorError):
    """Raised when topic/keyword extraction fails."""
    def __init__(self, error_detail: str):
        self.error_detail = error_detail
        message = f"Topic extraction failed: {error_detail}"
        super().__init__(message, "topic_extraction_error")

class MetadataCreationError(MetadataExtractorError):
    """Raised when metadata creation fails."""
    def __init__(self, error_detail: str):
        self.error_detail = error_detail
        message = f"Metadata creation failed: {error_detail}"
        super().__init__(message, "metadata_creation_error")

class InvalidInputError(MetadataExtractorError):
    """Raised when input data is invalid or insufficient."""
    def __init__(self, field: str, reason: str):
        self.field = field
        self.reason = reason
        message = f"Invalid input for {field}: {reason}"
        super().__init__(message, "invalid_input")