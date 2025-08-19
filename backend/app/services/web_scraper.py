import re
from typing import Optional, Tuple, List
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from bs4 import BeautifulSoup
import trafilatura
# from playwright.sync_api import sync_playwright

def setup_session() -> requests.Session:
    session = requests.Session()
    retries = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
    session.mount('http://', HTTPAdapter(max_retries=retries))
    session.mount('https://', HTTPAdapter(max_retries=retries))
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    })
    return session

def fetch_static_content(url: str, session: requests.Session) -> Optional[str]:
    try:
        response = session.get(url, timeout=10)
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException:
        return None

# def fetch_dynamic_content(url: str) -> Optional[str]:
#     try:
#         with sync_playwright() as p:
#             browser = p.chromium.launch()
#             page = browser.new_page()
#             page.goto(url, timeout=10000)
#             page.wait_for_timeout(2000)  # Wait for dynamic content
#             content = page.content()
#             browser.close()
#             return content
#     except Exception as e:
#         return None

def extract_with_trafilatura(content: str, min_content_length: int) -> Tuple[Optional[str], dict]:
    metadata = {
        'title': '',
        'author': '',
        'date': '',
        # 'language': '',
        'sitename': '',
        # 'description': ''
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
                # metadata['description'] = traf_metadata.description if hasattr(traf_metadata, 'description') else ''
                
                # if hasattr(traf_metadata, 'language') and traf_metadata.language:
                #     metadata['language'] = traf_metadata.language
                # else:
                #     soup = BeautifulSoup(content, 'html.parser')
                #     metadata['language'] = soup.html.get('lang', '') if soup.html else ''


            final_content = re.sub(r'\s+', ' ', extracted.strip()).strip()
            return final_content, metadata
    except Exception as e:
        pass
    return None, metadata

def clean_soup(soup: BeautifulSoup) -> None:
    for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
        element.decompose()

def extract_with_beautifulsoup(content: str, min_content_length: int, min_line_length: int) -> Tuple[Optional[str], dict]:
    
    metadata = {
        'title': '',
        'author': '',
        'date': '',
        # 'language': '',
        'sitename': '',
        # 'description': ''
    }
    
    soup = BeautifulSoup(content, 'html.parser')
    clean_soup(soup)
    
    # Extract metadata
    title_elem = soup.find('title') or soup.find('meta', attrs={'name': 'title'}) or soup.find('meta', attrs={'property': 'og:title'})
    metadata['title'] = title_elem.get_text(strip=True) if title_elem else ''
    
    author_elem = soup.find('meta', attrs={'name': 'author'}) or soup.find('meta', attrs={'property': 'article:author'})
    metadata['author'] = author_elem.get('content', '') if author_elem else ''
    
    date_elem = soup.find('meta', attrs={'name': 'date'}) or soup.find('meta', attrs={'property': 'article:published_time'}) or soup.find('meta', attrs={'name': 'pubdate'})
    metadata['date'] = date_elem.get('content', '') if date_elem else ''
    
    # metadata['language'] = soup.html.get('lang', '') if soup.html else ''
    
    sitename_elem = soup.find('meta', attrs={'property': 'og:site_name'})
    metadata['sitename'] = sitename_elem.get('content', '') if sitename_elem else ''
    
    # desc_elem = soup.find('meta', attrs={'name': 'description'}) or soup.find('meta', attrs={'property': 'og:description'})
    # metadata['description'] = desc_elem.get('content', '') if desc_elem else ''
    
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
        return None
    
    
    return final_content, metadata

def scrape_webpage(url: str, use_dynamic: bool=True) -> Tuple[Optional[str], dict]:

    # Hardcoded parameters
    MIN_CONTENT_LENGTH = 50
    MIN_LINE_LENGTH = 10
    
    # TODO Dynamic fetching with Playwright currently disabled
    
    # Fetch content
    # if use_dynamic:
    #     content = fetch_dynamic_content(url)
    # else:
    session = setup_session()
    content = fetch_static_content(url, session)
    
    if not content:
        return None
    
    # Try trafilatura first
    final_content, metadata = extract_with_trafilatura(content, MIN_CONTENT_LENGTH)
    if final_content:
        return final_content, metadata
    
    # Fallback to BeautifulSoup
    final_content, metadata = extract_with_beautifulsoup(content, MIN_CONTENT_LENGTH, MIN_LINE_LENGTH)
    return final_content, metadata

if __name__ == "__main__":
    url = "https://github.com/adbar/trafilatura"
    content, metadata = scrape_webpage(url, use_dynamic=False)
    if content and metadata:
        print("Scraped Content:")
        print(content)
        print("\nMetadata:")
        print(metadata)
    else:
        print("Failed to scrape content.")