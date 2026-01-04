import httpx
from typing import List, Dict
from urllib.parse import quote_plus
from bs4 import BeautifulSoup


def search_duckduckgo(query: str, max_results: int = 5) -> str:
    """
    Search for information on DuckDuckGo search engine.
    Use this tool when you need to find current information, facts, or when you're not sure about an answer.
    
    Args:
        query: The search query string
        max_results: Maximum number of results (default: 5)
        
    Returns:
        A formatted string containing search results with titles, URLs, and snippets
    """
    try:
        # DuckDuckGo HTML search
        url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        with httpx.Client(timeout=15.0, headers=headers, follow_redirects=True) as client:
            response = client.get(url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            results = []
            
            # Parse kết quả
            for result in soup.find_all('div', class_='result', limit=max_results):
                try:
                    title_tag = result.find('a', class_='result__a')
                    snippet_tag = result.find('a', class_='result__snippet')
                    
                    if title_tag:
                        title = title_tag.get_text(strip=True)
                        url = title_tag.get('href', '')
                        snippet = snippet_tag.get_text(strip=True) if snippet_tag else ""
                        
                        results.append({
                            'title': title,
                            'url': url,
                            'snippet': snippet
                        })
                except Exception as e:
                    continue
            
            # Format results as string for agent
            if results:
                result_parts = []
                for i, result in enumerate(results, 1):
                    result_str = f"{i}. {result['title']}\n"
                    if result.get('url'):
                        result_str += f"   URL: {result['url']}\n"
                    if result.get('snippet'):
                        result_str += f"   {result['snippet']}\n"
                    result_parts.append(result_str)
                
                return "\n".join(result_parts)
            else:
                return f"Search query '{query}' executed but no results found. Please try rephrasing your query or use the search_url tool to visit specific websites."
            
    except Exception as e:
        return f"Error searching DuckDuckGo: {str(e)}. Please try rephrasing your query or use the search_url tool to visit specific websites."
