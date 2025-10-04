"""YouTube-specific errors for transcript extraction."""


class YouTubeError(Exception):
    """Base class for YouTube-related errors."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(self.message)


class InvalidVideoURLError(YouTubeError):
    """Raised when YouTube URL is invalid or video ID cannot be extracted."""

    def __init__(self, url: str):
        super().__init__(f"Invalid YouTube URL: {url}")


class TranscriptNotAvailableError(YouTubeError):
    """Raised when no transcript/captions are available for the video."""

    def __init__(self, video_id: str):
        super().__init__(
            f"No transcript available for video {video_id}. "
            "Video may not have captions or may be private/deleted."
        )


class YouTubeAPIError(YouTubeError):
    """Raised when YouTube API fails."""

    def __init__(self, video_id: str, details: str):
        super().__init__(f"YouTube API error for video {video_id}: {details}")
