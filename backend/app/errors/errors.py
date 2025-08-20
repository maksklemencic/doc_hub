class ServiceError(Exception):
    """Base exception for service errors"""
    def __init__(self, message: str, code: str = "service_error"):
        self.message = message
        self.code = code
        super().__init__(message)

class NotFoundError(ServiceError):
    """Raised when a resource is not found"""
    def __init__(self, resource: str, id: str):
        super().__init__(f"{resource} with id {id} not found", code=f"{resource.lower()}_not_found")

class PermissionError(ServiceError):
    """Raised when user lacks permission"""
    def __init__(self, message: str = "Permission denied"):
        super().__init__(message, code="permission_denied")

class DatabaseError(ServiceError):
    """Raised for database operation errors"""
    def __init__(self, message: str):
        super().__init__(message, code="database_error")

class ConflictError(ServiceError):
    """Raised for database conflicts (e.g., unique constraint violations)"""
    def __init__(self, message: str):
        super().__init__(message, code="conflict_error")