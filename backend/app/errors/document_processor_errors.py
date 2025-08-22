class DocumentProcessorError(Exception):
    """Base exception for document processing errors."""
    def __init__(self, message: str, code: str = "document_processor_error"):
        self.message = message
        self.code = code
        super().__init__(message)

class UnsupportedDocumentTypeError(DocumentProcessorError):
    """Raised when document type is not supported."""
    def __init__(self, file_type: str, supported_types: list):
        self.file_type = file_type
        self.supported_types = supported_types
        message = f"Unsupported document type: '{file_type}'. Supported types are: {', '.join(supported_types)}"
        super().__init__(message, "unsupported_document_type")

class DocumentCorruptedError(DocumentProcessorError):
    """Raised when document file is corrupted or cannot be opened."""
    def __init__(self, file_type: str, error_detail: str):
        self.file_type = file_type
        self.error_detail = error_detail
        message = f"Failed to open {file_type} file: {error_detail}"
        super().__init__(message, "document_corrupted")

class EmptyDocumentError(DocumentProcessorError):
    """Raised when document contains no readable text."""
    def __init__(self, file_type: str):
        self.file_type = file_type
        message = f"No readable text found in {file_type} file"
        super().__init__(message, "empty_document")

class TextExtractionError(DocumentProcessorError):
    """Raised when text extraction fails for a specific document."""
    def __init__(self, file_type: str, error_detail: str):
        self.file_type = file_type
        self.error_detail = error_detail
        message = f"Text extraction failed for {file_type}: {error_detail}"
        super().__init__(message, "text_extraction_error")

class OCRError(DocumentProcessorError):
    """Raised when OCR processing fails."""
    def __init__(self, error_detail: str):
        self.error_detail = error_detail
        message = f"OCR processing failed: {error_detail}"
        super().__init__(message, "ocr_error")

class Base64DecodingError(DocumentProcessorError):
    """Raised when base64 decoding fails."""
    def __init__(self, error_detail: str):
        self.error_detail = error_detail
        message = f"Base64 decoding failed: {error_detail}"
        super().__init__(message, "base64_decoding_error")