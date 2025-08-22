import logging
import re
from typing import Tuple, Optional
from urllib.parse import urlparse

import requests
import trafilatura
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from ..errors.web_scraper_errors import (
    ContentExtractionError,
    HTTPError,
    InsufficientContentError,
    InvalidURLError,
    RequestTimeoutError,
    URLFetchError,
)

logger = logging.getLogger(__name__)

def setup_session() -> requests.Session:
    session = requests.Session()
    retries = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
    session.mount('http://', HTTPAdapter(max_retries=retries))
    session.mount('https://', HTTPAdapter(max_retries=retries))
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    })
    return session

def validate_url(url: str) -> None:
    if not url or not url.strip():
        raise InvalidURLError(url)
    
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            raise InvalidURLError(url)
    except Exception:
        raise InvalidURLError(url)

def fetch_static_content(url: str, session: requests.Session) -> str:
    logger.info(f"Fetching content from URL: {url}")
    validate_url(url)
    
    try:
        response = session.get(url, timeout=10)
        response.raise_for_status()
        logger.info(f"Successfully fetched content from {url}")
        return response.text
    except requests.exceptions.Timeout as e:
        logger.error(f"Request timeout for URL {url}: {str(e)}")
        raise RequestTimeoutError(url, 10)
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error for URL {url}: {str(e)}")
        raise HTTPError(url, response.status_code, response.reason)
    except requests.exceptions.RequestException as e:
        logger.error(f"Request failed for URL {url}: {str(e)}")
        raise URLFetchError(url, str(e))


def extract_with_trafilatura(content: str, min_content_length: int, url: str) -> Tuple[Optional[str], dict]:
    logger.debug(f"Attempting trafilatura extraction for {url}")
    metadata = {
        'title': '',
        'author': '',
        'date': '',
        'sitename': '',
    }
    
    try:
        extracted = trafilatura.extract(content)
        if extracted and len(extracted.strip()) > min_content_length:
            traf_metadata = trafilatura.extract_metadata(content)
            if traf_metadata:
                metadata['title'] = traf_metadata.title if hasattr(traf_metadata, 'title') else ''
                metadata['author'] = traf_metadata.author if hasattr(traf_metadata, 'author') else ''
                metadata['date'] = traf_metadata.date if hasattr(traf_metadata, 'date') else ''
                metadata['sitename'] = traf_metadata.sitename if hasattr(traf_metadata, 'sitename') else ''

            final_content = re.sub(r'\s+', ' ', extracted.strip()).strip()
            logger.debug(f"Trafilatura extraction successful for {url}: {len(final_content)} characters")
            return final_content, metadata
        else:
            logger.debug(f"Trafilatura extraction insufficient content for {url}: {len(extracted) if extracted else 0} characters")
    except Exception as e:
        logger.warning(f"Trafilatura extraction failed for {url}: {str(e)}")
        raise ContentExtractionError(url, "trafilatura", str(e))
    
    return None, metadata

def clean_soup(soup: BeautifulSoup) -> None:
    for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
        element.decompose()

def extract_with_beautifulsoup(content: str, min_content_length: int, min_line_length: int, url: str) -> Tuple[str, dict]:
    logger.debug(f"Attempting BeautifulSoup extraction for {url}")
    metadata = {
        'title': '',
        'author': '',
        'date': '',
        'sitename': '',
    }
    
    try:
        soup = BeautifulSoup(content, 'html.parser')
        clean_soup(soup)
        
        # Extract metadata
        title_elem = soup.find('title') or soup.find('meta', attrs={'name': 'title'}) or soup.find('meta', attrs={'property': 'og:title'})
        metadata['title'] = title_elem.get_text(strip=True) if title_elem else ''
        
        author_elem = soup.find('meta', attrs={'name': 'author'}) or soup.find('meta', attrs={'property': 'article:author'})
        metadata['author'] = author_elem.get('content', '') if author_elem else ''
        
        date_elem = soup.find('meta', attrs={'name': 'date'}) or soup.find('meta', attrs={'property': 'article:published_time'}) or soup.find('meta', attrs={'name': 'pubdate'})
        metadata['date'] = date_elem.get('content', '') if date_elem else ''
        
        sitename_elem = soup.find('meta', attrs={'property': 'og:site_name'})
        metadata['sitename'] = sitename_elem.get('content', '') if sitename_elem else ''
        
        # Expanded selector list
        content_selectors = [
            'article',
            '[role="main"]',
            '.content',
            '.post-content',
            '.entry-content',
            'main',
            '.main-content',
            '[id*="content"]',
            '.article-body',
            '.main',
            '.story-body',
            '[itemprop="articleBody"]'
        ]
        
        # Collect content from all matching selectors
        content_areas = []
        for selector in content_selectors:
            elements = soup.select(selector)
            for element in elements:
                text = element.get_text(strip=True, separator='\n')
                if text:
                    content_areas.append(text)
        
        # Fallback to full text if no selectors matched
        if not content_areas:
            content = soup.get_text(strip=True, separator='\n')
            content_areas.append(content)
        
        # Clean and combine content
        final_content = '\n'.join(content_areas)
        lines = final_content.split('\n')
        cleaned_lines = [line.strip() for line in lines if line.strip() and len(line.strip()) >= min_line_length]
        final_content = '\n'.join(cleaned_lines)
        
        # Normalize whitespace
        final_content = re.sub(r'\s+', ' ', final_content).strip()
        
        # Validate content length
        if len(final_content) < min_content_length:
            logger.warning(f"BeautifulSoup extraction insufficient content for {url}: {len(final_content)} characters")
            raise InsufficientContentError(url, len(final_content), min_content_length)
        
        logger.debug(f"BeautifulSoup extraction successful for {url}: {len(final_content)} characters")
        return final_content, metadata
    
    except Exception as e:
        if isinstance(e, InsufficientContentError):
            raise
        logger.error(f"BeautifulSoup extraction failed for {url}: {str(e)}")
        raise ContentExtractionError(url, "beautifulsoup", str(e))

def scrape_webpage(url: str) -> Tuple[str, dict]:
    logger.info(f"Starting web scraping for URL: {url}")
    
    # Hardcoded parameters
    MIN_CONTENT_LENGTH = 50
    MIN_LINE_LENGTH = 10
    
    validate_url(url)
    
    # Fetch content using static scraping only
    session = setup_session()
    content = fetch_static_content(url, session)
    
    metadata = {
        'url': url,
        'title': '',
        'author': '',
        'date': '',
        'sitename': '',
    }
    
    try:
        # Try trafilatura first
        final_content, traf_metadata = extract_with_trafilatura(content, MIN_CONTENT_LENGTH, url)
        if final_content:
            metadata.update(traf_metadata)
            logger.info(f"Successfully scraped webpage using trafilatura: {url}")
            return final_content, metadata
    except ContentExtractionError:
        logger.debug(f"Trafilatura extraction failed for {url}, trying BeautifulSoup")
    
    try:
        # Fallback to BeautifulSoup
        final_content, soup_metadata = extract_with_beautifulsoup(content, MIN_CONTENT_LENGTH, MIN_LINE_LENGTH, url)
        metadata.update(soup_metadata)
        logger.info(f"Successfully scraped webpage using BeautifulSoup: {url}")
        return final_content, metadata
    except (ContentExtractionError, InsufficientContentError) as e:
        logger.error(f"All content extraction methods failed for {url}")
        raise