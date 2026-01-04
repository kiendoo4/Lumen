import httpx
import re


def search_url(url: str, question: str = "") -> str:
    """
    Read and extract information from a specific URL.
    Use this tool when the user asks you to visit a specific webpage, read content from a URL, 
    or extract information from a website.
    
    Args:
        url: The URL to visit and read
        question: Optional question or instruction about what information to extract from the page
        
    Returns:
        A string containing the extracted text content from the webpage
    """
    try:
        # Ensure URL has a protocol
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        
        # Set headers to mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        with httpx.Client(timeout=15.0, follow_redirects=True, headers=headers) as client:
            response = client.get(url)
            response.raise_for_status()
            
            # Get the HTML content
            html_content = response.text
            
            # Simple text extraction: remove HTML tags and clean up
            # Remove script and style elements
            html_content = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
            html_content = re.sub(r'<style[^>]*>.*?</style>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
            
            # Remove HTML tags
            text = re.sub(r'<[^>]+>', ' ', html_content)
            
            # Clean up whitespace
            text = re.sub(r'\s+', ' ', text)
            text = text.strip()
            
            # Limit the length to avoid token limits (keep first 20000 characters)
            if len(text) > 20000:
                text = text[:20000] + "... [Content truncated]"
            
            if not text or len(text.strip()) < 10:
                return f"Could not extract meaningful text content from {url}. The page might be empty or require JavaScript to load content."
            
            result = f"Content from {url}:\n\n{text}"
            
            return result
            
    except httpx.HTTPStatusError as e:
        return f"Error accessing URL {url}: HTTP {e.response.status_code} - {e.response.reason_phrase}"
    except httpx.TimeoutException:
        return f"Timeout error: Could not access {url} within the time limit. The website might be slow or unavailable."
    except httpx.RequestError as e:
        return f"Error requesting URL {url}: {str(e)}"
    except Exception as e:
        return f"Unexpected error reading URL {url}: {str(e)}"

