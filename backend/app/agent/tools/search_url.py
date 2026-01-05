import httpx
import re
import json
from io import BytesIO


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
        
        with httpx.Client(timeout=30.0, follow_redirects=True, headers=headers) as client:
            response = client.get(url)
            response.raise_for_status()
            
            # Check if the response is a PDF
            content_type = response.headers.get('content-type', '').lower()
            is_pdf = (
                content_type == 'application/pdf' or 
                url.lower().endswith('.pdf') or
                '/pdf/' in url.lower() or
                'arxiv.org/pdf' in url.lower()
            )
            
            if is_pdf:
                # Handle PDF files
                try:
                    # Try to use pypdf (PyPDF2 successor)
                    try:
                        from pypdf import PdfReader
                    except ImportError:
                        # Fallback to PyPDF2 if pypdf not available
                        try:
                            from PyPDF2 import PdfReader
                        except ImportError:
                            return f"PDF reading library not available. Please install pypdf or PyPDF2: pip install pypdf"
                    
                    pdf_file = BytesIO(response.content)
                    pdf_reader = PdfReader(pdf_file)
                    
                    text_parts = []
                    total_pages = len(pdf_reader.pages)
                    
                    # Extract text from first 20 pages to avoid token limits
                    max_pages = min(20, total_pages)
                    
                    for page_num in range(max_pages):
                        try:
                            page = pdf_reader.pages[page_num]
                            page_text = page.extract_text()
                            if page_text and page_text.strip():
                                text_parts.append(page_text)
                        except Exception as e:
                            # Skip pages that can't be read
                            continue
                    
                    if not text_parts:
                        return f"Could not extract text from PDF at {url}. The PDF might be image-based or encrypted."
                    
                    text = "\n\n".join(text_parts)
                    
                    # Clean up whitespace
                    text = re.sub(r'\s+', ' ', text)
                    text = text.strip()
                    
                    # Limit the length to avoid token limits (keep first 20000 characters)
                    if len(text) > 20000:
                        text = text[:20000] + f"... [Content truncated. PDF has {total_pages} pages, showing first {max_pages} pages]"
                    else:
                        text += f"\n\n[Note: PDF has {total_pages} pages, showing all extracted text]"
                    
                    result = f"Content from PDF {url}:\n\n{text}"
                    
                    # Extract title from PDF if possible (first line or first few words)
                    title = ""
                    if text_parts:
                        first_part = text_parts[0]
                        # Try to extract title (first line or first 100 chars)
                        lines = first_part.split('\n')
                        if lines:
                            title = lines[0].strip()[:200]  # First line, max 200 chars
                            if not title or len(title) < 10:
                                # Fallback: first 100 chars of text
                                title = text[:100].strip()
                    
                    # Create citation metadata
                    citation_metadata = [{
                        'index': 1,
                        'url': url,
                        'title': title or url.split('/')[-1] or 'PDF Document',
                        'type': 'pdf',
                        'content_preview': text[:500] if len(text) > 500 else text,  # Preview for reference
                        'full_content': text  # Store full content for retrieval
                    }]
                    
                    citation_json = f"\n\n[CITATION_METADATA]{json.dumps(citation_metadata)}[/CITATION_METADATA]"
                    return result + citation_json
                    
                except Exception as e:
                    return f"Error reading PDF from {url}: {str(e)}. The PDF might be corrupted or password-protected."
            
            # Handle HTML content
            try:
                html_content = response.text
            except UnicodeDecodeError:
                # If can't decode as text, might be binary content
                return f"Could not read content from {url}. The file might be binary or in an unsupported format."
            
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
            
            # Try to extract title from HTML
            title = ""
            try:
                # Look for title tag
                title_match = re.search(r'<title[^>]*>(.*?)</title>', html_content, re.IGNORECASE | re.DOTALL)
                if title_match:
                    title = re.sub(r'<[^>]+>', '', title_match.group(1)).strip()[:200]
                # Fallback: use first meaningful line of text
                if not title:
                    lines = text.split('\n')
                    for line in lines:
                        line = line.strip()
                        if len(line) > 10 and len(line) < 200:
                            title = line
                            break
                # Final fallback: use URL filename or domain
                if not title:
                    title = url.split('/')[-1] or url.split('/')[-2] or 'Web Page'
            except:
                title = url.split('/')[-1] or 'Web Page'
            
            # Create citation metadata
            citation_metadata = [{
                'index': 1,
                'url': url,
                'title': title,
                'type': 'url',
                'content_preview': text[:500] if len(text) > 500 else text,  # Preview for reference
                'full_content': text  # Store full content for retrieval
            }]
            
            citation_json = f"\n\n[CITATION_METADATA]{json.dumps(citation_metadata)}[/CITATION_METADATA]"
            return result + citation_json
            
    except httpx.HTTPStatusError as e:
        return f"Error accessing URL {url}: HTTP {e.response.status_code} - {e.response.reason_phrase}"
    except httpx.TimeoutException:
        return f"Timeout error: Could not access {url} within the time limit. The website might be slow or unavailable."
    except httpx.RequestError as e:
        return f"Error requesting URL {url}: {str(e)}"
    except Exception as e:
        return f"Unexpected error reading URL {url}: {str(e)}"

