"""
Screenshot service for capturing webpage screenshots using Playwright.

This service provides functionality to capture full-page screenshots of webpages
for preview and vision-based text extraction.
"""

import logging
from typing import Optional
from urllib.parse import urlparse

from ..errors.web_scraper_errors import InvalidURLError, URLFetchError

logger = logging.getLogger(__name__)


async def capture_webpage_screenshot(
    url: str,
    viewport_width: int = 1920,
    viewport_height: int = 1080,
    timeout: int = 30000,
    wait_for_network: bool = True
) -> bytes:
    """
    Capture a full-page screenshot of a webpage using Playwright.

    Args:
        url: The URL to capture
        viewport_width: Browser viewport width in pixels (default: 1920)
        viewport_height: Browser viewport height in pixels (default: 1080)
        timeout: Navigation timeout in milliseconds (default: 30000)
        wait_for_network: Whether to wait for network to be idle (default: True)

    Returns:
        PNG screenshot as bytes

    Raises:
        InvalidURLError: If the URL is invalid
        URLFetchError: If screenshot capture fails
    """
    logger.info(f"Capturing screenshot for URL: {url}")

    # Validate URL
    if not url or not url.strip():
        raise InvalidURLError(url)

    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            raise InvalidURLError(url)
    except Exception:
        raise InvalidURLError(url)

    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            # Launch browser in headless mode
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            )

            # Create new page with specified viewport
            page = await browser.new_page(
                viewport={'width': viewport_width, 'height': viewport_height}
            )

            # Set a reasonable user agent
            await page.set_extra_http_headers({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            })

            # Navigate to URL
            wait_until = 'networkidle' if wait_for_network else 'load'
            logger.debug(f"Navigating to {url} with wait_until={wait_until}")

            try:
                await page.goto(url, wait_until=wait_until, timeout=timeout)
            except Exception as nav_error:
                # If networkidle fails, try with just 'load'
                if wait_for_network:
                    logger.warning(f"Network idle wait failed, retrying with 'load': {str(nav_error)}")
                    await page.goto(url, wait_until='load', timeout=timeout)
                else:
                    raise

            # Wait a bit for any dynamic content to render
            await page.wait_for_timeout(2000)

            # Capture full-page screenshot
            logger.debug(f"Capturing full-page screenshot for {url}")
            screenshot_bytes = await page.screenshot(
                full_page=True,
                type='png'
            )

            await browser.close()

            logger.info(f"Successfully captured screenshot for {url}: {len(screenshot_bytes)} bytes")
            return screenshot_bytes

    except ImportError as e:
        logger.error(f"Playwright not installed: {str(e)}")
        raise URLFetchError(
            url,
            "Playwright is not installed. Install with: pip install playwright && playwright install chromium"
        )
    except Exception as e:
        logger.error(f"Failed to capture screenshot for {url}: {str(e)}")
        raise URLFetchError(url, f"Screenshot capture failed: {str(e)}")


async def capture_webpage_with_fallback(url: str) -> Optional[bytes]:
    """
    Attempt to capture webpage screenshot with fallback options.

    Tries different configurations if the first attempt fails.

    Args:
        url: The URL to capture

    Returns:
        PNG screenshot bytes or None if all attempts fail
    """
    logger.info(f"Attempting screenshot capture with fallback for: {url}")

    # Try 1: Full network idle wait
    try:
        return await capture_webpage_screenshot(url, wait_for_network=True, timeout=30000)
    except Exception as e:
        logger.warning(f"Screenshot attempt 1 failed (networkidle): {str(e)}")

    # Try 2: Just wait for load event
    try:
        return await capture_webpage_screenshot(url, wait_for_network=False, timeout=20000)
    except Exception as e:
        logger.warning(f"Screenshot attempt 2 failed (load): {str(e)}")

    # Try 3: Shorter timeout, no network wait
    try:
        return await capture_webpage_screenshot(url, wait_for_network=False, timeout=10000)
    except Exception as e:
        logger.error(f"All screenshot attempts failed for {url}: {str(e)}")
        return None
