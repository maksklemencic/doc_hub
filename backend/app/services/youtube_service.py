"""Service for extracting transcripts from YouTube videos."""

import logging
import re
from typing import List, Tuple, Dict, Optional
from urllib.parse import urlparse, parse_qs

import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)

from ..errors.youtube_errors import (
    InvalidVideoURLError,
    TranscriptNotAvailableError,
    YouTubeAPIError,
)

logger = logging.getLogger(__name__)


def extract_video_id(url: str) -> str:
    """
    Extract video ID from various YouTube URL formats.

    Supports:
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    - https://www.youtube.com/embed/VIDEO_ID
    - https://m.youtube.com/watch?v=VIDEO_ID

    Args:
        url: YouTube video URL

    Returns:
        Video ID string

    Raises:
        InvalidVideoURLError: If URL is invalid or video ID cannot be extracted
    """
    logger.info(f"Extracting video ID from URL: {url}")

    # Pattern 1: youtu.be short links
    pattern1 = r'(?:https?://)?(?:www\.)?youtu\.be/([a-zA-Z0-9_-]{11})'

    # Pattern 2: youtube.com watch URLs
    pattern2 = r'(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})'

    # Pattern 3: youtube.com embed URLs
    pattern3 = r'(?:https?://)?(?:www\.)?youtube\.com/embed/([a-zA-Z0-9_-]{11})'

    # Pattern 4: mobile URLs
    pattern4 = r'(?:https?://)?(?:m\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})'

    for pattern in [pattern1, pattern2, pattern3, pattern4]:
        match = re.search(pattern, url)
        if match:
            video_id = match.group(1)
            logger.info(f"Extracted video ID: {video_id}")
            return video_id

    # Try parsing query parameters as fallback
    try:
        parsed = urlparse(url)
        if 'youtube.com' in parsed.netloc:
            query_params = parse_qs(parsed.query)
            if 'v' in query_params:
                video_id = query_params['v'][0]
                logger.info(f"Extracted video ID from query params: {video_id}")
                return video_id
    except Exception as e:
        logger.warning(f"Failed to parse URL query params: {str(e)}")

    logger.error(f"Could not extract video ID from URL: {url}")
    raise InvalidVideoURLError(url)


def get_transcript(video_id: str, languages: Optional[List[str]] = None) -> List[Dict]:
    """
    Fetch transcript for a YouTube video.

    Args:
        video_id: YouTube video ID
        languages: Preferred languages (default: ['en'])

    Returns:
        List of transcript segments with 'text', 'start', 'duration'

    Raises:
        TranscriptNotAvailableError: If no transcript is available
        YouTubeAPIError: If YouTube API fails
    """
    if languages is None:
        languages = ['en']

    logger.info(f"Fetching transcript for video {video_id} (languages: {languages})")

    try:
        # Instantiate the API and fetch transcript
        ytt_api = YouTubeTranscriptApi()
        fetched_transcript = ytt_api.fetch(video_id, languages=languages)

        # Convert FetchedTranscriptSnippet objects to dictionaries
        transcript = []
        for snippet in fetched_transcript.snippets:
            transcript.append({
                'text': snippet.text,
                'start': snippet.start,
                'duration': snippet.duration
            })

        logger.info(f"Successfully fetched transcript with {len(transcript)} segments")
        return transcript

    except (TranscriptsDisabled, NoTranscriptFound) as e:
        logger.warning(f"No transcript available for video {video_id}: {str(e)}")
        raise TranscriptNotAvailableError(video_id)

    except VideoUnavailable as e:
        logger.error(f"Video {video_id} is unavailable: {str(e)}")
        raise YouTubeAPIError(video_id, "Video is unavailable or private")

    except Exception as e:
        logger.error(f"Unexpected error fetching transcript for {video_id}: {str(e)}")
        raise YouTubeAPIError(video_id, str(e))


def format_timestamp(seconds: float) -> str:
    """
    Format seconds as HH:MM:SS or MM:SS.

    Args:
        seconds: Time in seconds

    Returns:
        Formatted timestamp string
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)

    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes:02d}:{secs:02d}"


def convert_to_time_segmented_markdown(
    transcript: List[Dict],
    segment_duration: int = 60
) -> List[Tuple[int, str]]:
    """
    Convert transcript to time-segmented pages with markdown headers.

    NOTE: This creates SIMPLE markdown (headers + text), not rich formatting.
    The transcript text is preserved as spoken, with timestamp section headers.

    Example output:
    ## 00:00

    Hello everyone welcome to my video today we'll discuss...

    ## 01:00

    Now let's move on to the main topic which is...

    Groups transcript segments into time-based sections (e.g., every 60 seconds)
    and adds markdown headers with timestamps.

    Args:
        transcript: List of transcript segments from YouTube
        segment_duration: Duration of each section in seconds (default: 60)

    Returns:
        List of (section_number, markdown_text) tuples
    """
    logger.info(f"Converting transcript to markdown (segment duration: {segment_duration}s)")

    if not transcript:
        return [(1, "")]

    pages = []
    current_section = 0
    current_start_time = 0
    current_text_parts = []

    for segment in transcript:
        start_time = segment['start']
        text = segment['text'].strip()

        # Check if we need to start a new section
        if start_time >= (current_section + 1) * segment_duration:
            # Save current section
            if current_text_parts:
                section_text = " ".join(current_text_parts)
                timestamp = format_timestamp(current_start_time)
                markdown = f"## {timestamp}\n\n{section_text}"
                pages.append((current_section + 1, markdown))

            # Start new section
            current_section = int(start_time // segment_duration)
            current_start_time = current_section * segment_duration
            current_text_parts = [text]
        else:
            current_text_parts.append(text)

    # Add final section
    if current_text_parts:
        section_text = " ".join(current_text_parts)
        timestamp = format_timestamp(current_start_time)
        markdown = f"## {timestamp}\n\n{section_text}"
        pages.append((current_section + 1, markdown))

    logger.info(f"Created {len(pages)} time-segmented pages from transcript")
    return pages


def get_video_metadata(video_id: str) -> Dict[str, str]:
    """
    Fetch video metadata using yt-dlp.

    Args:
        video_id: YouTube video ID

    Returns:
        Dict with video title, channel, duration, etc.

    Raises:
        YouTubeAPIError: If metadata extraction fails
    """
    logger.info(f"Fetching video metadata for {video_id}")

    try:
        url = f"https://www.youtube.com/watch?v={video_id}"
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'skip_download': True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

            metadata = {
                'title': info.get('title', f'YouTube Video {video_id}'),
                'channel': info.get('uploader', 'Unknown'),
                'duration': str(info.get('duration', 0)),
                'description': info.get('description', '')[:500],  # First 500 chars
            }

            logger.info(f"Successfully extracted metadata: {metadata['title']}")
            return metadata

    except Exception as e:
        logger.error(f"Failed to extract video metadata for {video_id}: {str(e)}")
        # Return basic metadata if extraction fails
        return {
            'title': f'YouTube Video {video_id}',
            'channel': 'Unknown',
            'duration': '0',
            'description': '',
        }


def get_youtube_transcript_pages(
    url: str,
    segment_duration: int = 60,
    languages: Optional[List[str]] = None
) -> Tuple[List[Tuple[int, str]], Dict[str, str]]:
    """
    Main function to extract and format YouTube transcript.

    Args:
        url: YouTube video URL
        segment_duration: Duration of each section in seconds
        languages: Preferred transcript languages

    Returns:
        Tuple of (pages, metadata) where:
        - pages: List of (page_number, markdown_text)
        - metadata: Dict with video_id, title, channel, transcript_language, etc.

    Raises:
        InvalidVideoURLError, TranscriptNotAvailableError, YouTubeAPIError
    """
    logger.info(f"Processing YouTube video: {url}")

    # Extract video ID
    video_id = extract_video_id(url)

    # Get video metadata (title, channel, etc.)
    video_metadata = get_video_metadata(video_id)

    # Get transcript
    transcript = get_transcript(video_id, languages)

    # Detect transcript language from the fetched transcript
    detected_language = "unknown"
    try:
        ytt_api = YouTubeTranscriptApi()
        fetched_transcript = ytt_api.fetch(video_id, languages=languages)
        detected_language = fetched_transcript.language_code
    except:
        # Fallback: try to get from list
        try:
            transcript_list = ytt_api.list(video_id)
            for t in transcript_list:
                detected_language = t.language_code
                break
        except:
            pass

    # Convert to markdown pages
    pages = convert_to_time_segmented_markdown(transcript, segment_duration)

    # Build metadata
    metadata = {
        "video_id": video_id,
        "title": video_metadata['title'],
        "channel": video_metadata['channel'],
        "duration": video_metadata['duration'],
        "description": video_metadata['description'],
        "transcript_language": detected_language,
    }

    logger.info(f"Successfully processed YouTube transcript: {metadata['title']} (language: {detected_language})")
    return pages, metadata
