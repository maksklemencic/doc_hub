class WebScraperError(Exception):
    """Base exception for web scraping errors."""
    def __init__(self, message: str, code: str = "web_scraper_error"):
        self.message = message
        self.code = code
        super().__init__(message)

class URLFetchError(WebScraperError):
    """Raised when URL cannot be fetched."""
    def __init__(self, url: str, error_detail: str):
        self.url = url
        self.error_detail = error_detail
        message = f"Failed to fetch URL {url}: {error_detail}"
        super().__init__(message, "url_fetch_error")

class InvalidURLError(WebScraperError):
    """Raised when URL is malformed or invalid."""
    def __init__(self, url: str):
        self.url = url
        message = f"Invalid URL: {url}"
        super().__init__(message, "invalid_url")

class ContentExtractionError(WebScraperError):
    """Raised when content extraction from webpage fails."""
    def __init__(self, url: str, method: str, error_detail: str):
        self.url = url
        self.method = method
        self.error_detail = error_detail
        message = f"Content extraction failed for {url} using {method}: {error_detail}"
        super().__init__(message, "content_extraction_error")

class InsufficientContentError(WebScraperError):
    """Raised when extracted content is too short or empty."""
    def __init__(self, url: str, content_length: int, min_length: int):
        self.url = url
        self.content_length = content_length
        self.min_length = min_length
        message = f"Insufficient content from {url}: got {content_length} characters, minimum required: {min_length}"
        super().__init__(message, "insufficient_content")

class RequestTimeoutError(WebScraperError):
    """Raised when HTTP request times out."""
    def __init__(self, url: str, timeout: int):
        self.url = url
        self.timeout = timeout
        message = f"Request to {url} timed out after {timeout} seconds"
        super().__init__(message, "request_timeout")

class HTTPError(WebScraperError):
    """Raised when HTTP request returns error status."""
    def __init__(self, url: str, status_code: int, reason: str):
        self.url = url
        self.status_code = status_code
        self.reason = reason
        message = f"HTTP {status_code} error for {url}: {reason}"
        super().__init__(message, "http_error")

class ParseError(WebScraperError):
    """Raised when HTML parsing fails."""
    def __init__(self, url: str, error_detail: str):
        self.url = url
        self.error_detail = error_detail
        message = f"HTML parsing failed for {url}: {error_detail}"
        super().__init__(message, "parse_error")