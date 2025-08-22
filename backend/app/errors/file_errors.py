class FileServiceError(Exception):
    """Base exception for file service errors."""
    def __init__(self, message: str, code: str = "file_service_error"):
        self.message = message
        self.code = code
        super().__init__(message)

class FileNotFoundError(FileServiceError):
    """Raised when a file is not found on the filesystem."""
    def __init__(self, file_path: str):
        self.file_path = file_path
        message = f"File not found: {file_path}"
        super().__init__(message, "file_not_found")

class FileDeleteError(FileServiceError):
    """Raised when file deletion fails."""
    def __init__(self, file_path: str, error_detail: str):
        self.file_path = file_path
        self.error_detail = error_detail
        message = f"Failed to delete file {file_path}: {error_detail}"
        super().__init__(message, "file_delete_error")

class FileReadError(FileServiceError):
    """Raised when file reading fails."""
    def __init__(self, file_path: str, error_detail: str):
        self.file_path = file_path
        self.error_detail = error_detail
        message = f"Failed to read file {file_path}: {error_detail}"
        super().__init__(message, "file_read_error")

class FileSaveError(FileServiceError):
    """Raised when file saving fails."""
    def __init__(self, file_path: str, error_detail: str):
        self.file_path = file_path
        self.error_detail = error_detail
        message = f"Failed to save file {file_path}: {error_detail}"
        super().__init__(message, "file_save_error")

class EmptyFileError(FileServiceError):
    """Raised when attempting to save an empty file."""
    def __init__(self, filename: str):
        self.filename = filename
        message = f"File is empty: {filename}"
        super().__init__(message, "empty_file_error")