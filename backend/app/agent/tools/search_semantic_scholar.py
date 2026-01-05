import httpx
import json
from typing import List, Dict, Optional, Union

"""
COMPLETE SEMANTIC SCHOLAR TOOLS SUITE

Based on semanticscholar Python library API

Format: Return formatted string with citation metadata
"""

# ============ TOOL 1: SEARCH PAPERS ============
def search_semantic_scholar(query: str, limit: int = 10) -> str:
    """
    Search for academic papers on Semantic Scholar using keywords.
    Use this tool when users ask about research papers, academic papers, scientific publications, 
    or scholarly articles. This is specifically designed for academic paper searches.
    
    Args:
        query: The search query string (keywords, paper title, author name, etc.)
        limit: Maximum number of results to return (default: 10, max: 100)
        
    Returns:
        A formatted string containing search results with paper titles, authors, years, URLs, and abstracts
    """
    try:
        base_url = "https://api.semanticscholar.org/graph/v1/paper/search"
        limit = min(max(1, limit), 100)
        
        params = {
            "query": query,
            "limit": limit,
            "fields": "title,authors,year,url,abstract,venue,citationCount,referenceCount,paperId"
        }
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        with httpx.Client(timeout=15.0, headers=headers, follow_redirects=True) as client:
            response = client.get(base_url, params=params)
            response.raise_for_status()
            
            data = response.json()
            papers = data.get('data', [])
            total = data.get('total', 0)
            
            if not papers:
                return f"No papers found for query '{query}'. Please try different keywords."
            
            result_parts = []
            citation_metadata = []
            
            for i, paper in enumerate(papers, 1):
                paper_str = f"{i}. {paper.get('title', 'Untitled')}\n"
                
                authors = paper.get('authors', [])
                if authors:
                    author_names = [author.get('name', '') for author in authors[:5]]
                    if len(authors) > 5:
                        author_names.append(f"and {len(authors) - 5} more")
                    paper_str += f"   Authors: {', '.join(author_names)}\n"
                
                if paper.get('year'):
                    paper_str += f"   Year: {paper.get('year')}\n"
                if paper.get('venue'):
                    paper_str += f"   Venue: {paper.get('venue')}\n"
                
                citation_count = paper.get('citationCount', 0)
                reference_count = paper.get('referenceCount', 0)
                if citation_count or reference_count:
                    stats = []
                    if citation_count:
                        stats.append(f"Citations: {citation_count}")
                    if reference_count:
                        stats.append(f"References: {reference_count}")
                    paper_str += f"   {', '.join(stats)}\n"
                
                if paper.get('url'):
                    paper_str += f"   URL: {paper.get('url')}\n"
                
                if paper.get('abstract'):
                    abstract = paper.get('abstract', '')
                    if len(abstract) > 300:
                        abstract = abstract[:300] + "..."
                    paper_str += f"   Abstract: {abstract}\n"
                
                result_parts.append(paper_str)
                
                citation_metadata.append({
                    'index': i,
                    'paperId': paper.get('paperId'),
                    'title': paper.get('title', 'Untitled'),
                    'url': paper.get('url', ''),
                    'authors': [author.get('name', '') for author in authors] if authors else [],
                    'year': paper.get('year'),
                    'venue': paper.get('venue', ''),
                    'abstract': paper.get('abstract', '')
                })
            
            if total:
                result_parts.insert(0, f"Found {total} papers (showing {len(papers)}):\n")
            
            formatted_result = "\n".join(result_parts)
            citation_json = f"\n\n[CITATION_METADATA]{json.dumps(citation_metadata)}[/CITATION_METADATA]"
            return formatted_result + citation_json
            
    except httpx.HTTPStatusError as e:
        return f"Error: HTTP {e.response.status_code}"
    except httpx.TimeoutException:
        return f"Error: Request timeout"
    except Exception as e:
        return f"Error: {str(e)}"

# ============ TOOL 2: GET PAPER BY ID ============
def get_paper_by_id(paper_id: str, fields: Optional[str] = None) -> str:
    """
    Get detailed information about a specific paper by its ID.
    
    Args:
        paper_id: Semantic Scholar paper ID, DOI, arXiv ID, etc.
        fields: Comma-separated fields to return (default: comprehensive set)
        
    Returns:
        Formatted string with detailed paper information
    """
    try:
        if fields is None:
            fields = "paperId,title,abstract,year,authors,venue,citationCount,referenceCount,influentialCitationCount,fieldsOfStudy,publicationTypes,publicationDate,journal,openAccessPdf,externalIds"
        
        base_url = f"https://api.semanticscholar.org/graph/v1/paper/{paper_id}"
        params = {"fields": fields}
        
        headers = {'User-Agent': 'Mozilla/5.0'}
        
        with httpx.Client(timeout=15.0, headers=headers) as client:
            response = client.get(base_url, params=params)
            response.raise_for_status()
            
            paper = response.json()
            
            result = f"Paper: {paper.get('title', 'Untitled')}\n"
            result += f"Paper ID: {paper.get('paperId')}\n\n"
            
            authors = paper.get('authors', [])
            if authors:
                author_names = [f"{a.get('name', '')} (ID: {a.get('authorId', 'N/A')})" 
                               for a in authors[:10]]
                result += f"Authors: {', '.join(author_names)}\n"
            
            if paper.get('year'):
                result += f"Year: {paper.get('year')}\n"
            if paper.get('publicationDate'):
                result += f"Publication Date: {paper.get('publicationDate')}\n"
            if paper.get('venue'):
                result += f"Venue: {paper.get('venue')}\n"
            if paper.get('journal'):
                journal = paper['journal']
                result += f"Journal: {journal.get('name', 'N/A')}\n"
            
            result += f"\nCitation Count: {paper.get('citationCount', 0)}\n"
            result += f"Reference Count: {paper.get('referenceCount', 0)}\n"
            result += f"Influential Citations: {paper.get('influentialCitationCount', 0)}\n"
            
            if paper.get('fieldsOfStudy'):
                result += f"Fields: {', '.join(paper['fieldsOfStudy'])}\n"
            
            if paper.get('publicationTypes'):
                result += f"Publication Types: {', '.join(paper['publicationTypes'])}\n"
            
            if paper.get('openAccessPdf'):
                result += f"\nOpen Access PDF: {paper['openAccessPdf'].get('url', 'N/A')}\n"
            
            external_ids = paper.get('externalIds', {})
            if external_ids:
                result += f"\nExternal IDs:\n"
                for key, value in external_ids.items():
                    result += f"  {key}: {value}\n"
            
            if paper.get('abstract'):
                result += f"\nAbstract:\n{paper['abstract']}\n"
            
            citation_metadata = [{
                'paperId': paper.get('paperId'),
                'title': paper.get('title'),
                'url': f"https://www.semanticscholar.org/paper/{paper.get('paperId')}",
                'authors': [a.get('name') for a in authors] if authors else [],
                'year': paper.get('year'),
                'abstract': paper.get('abstract', '')
            }]
            
            citation_json = f"\n[CITATION_METADATA]{json.dumps(citation_metadata)}[/CITATION_METADATA]"
            return result + citation_json
            
    except httpx.HTTPStatusError as e:
        return f"Error: Paper not found (HTTP {e.response.status_code})"
    except Exception as e:
        return f"Error: {str(e)}"

# ============ TOOL 3: GET AUTHOR BY ID ============
def get_author_by_id(author_id: str, fields: Optional[str] = None) -> str:
    """
    Get detailed information about an author by their ID.
    
    Args:
        author_id: Semantic Scholar author ID
        fields: Comma-separated fields to return
        
    Returns:
        Formatted string with author information and publications
    """
    try:
        if fields is None:
            fields = "authorId,name,url,aliases,affiliations,homepage,paperCount,citationCount,hIndex,papers,papers.title,papers.year,papers.citationCount"
        
        base_url = f"https://api.semanticscholar.org/graph/v1/author/{author_id}"
        params = {"fields": fields}
        
        headers = {'User-Agent': 'Mozilla/5.0'}
        
        with httpx.Client(timeout=15.0, headers=headers) as client:
            response = client.get(base_url, params=params)
            response.raise_for_status()
            
            author = response.json()
            
            result = f"Author: {author.get('name', 'Unknown')}\n"
            result += f"Author ID: {author.get('authorId')}\n"
            
            if author.get('url'):
                result += f"Profile: {author['url']}\n"
            if author.get('homepage'):
                result += f"Homepage: {author['homepage']}\n"
            
            if author.get('affiliations'):
                result += f"Affiliations: {', '.join(author['affiliations'])}\n"
            
            if author.get('aliases'):
                result += f"Aliases: {', '.join(author['aliases'])}\n"
            
            result += f"\nStatistics:\n"
            result += f"  Total Papers: {author.get('paperCount', 0)}\n"
            result += f"  Total Citations: {author.get('citationCount', 0)}\n"
            result += f"  h-index: {author.get('hIndex', 0)}\n"
            
            papers = author.get('papers', [])
            if papers:
                result += f"\nRecent Papers (showing top 10):\n"
                for i, paper in enumerate(papers[:10], 1):
                    result += f"{i}. {paper.get('title', 'Untitled')}\n"
                    result += f"   Year: {paper.get('year', 'N/A')}, Citations: {paper.get('citationCount', 0)}\n"
            
            citation_metadata = [{
                'authorId': author.get('authorId'),
                'name': author.get('name'),
                'url': author.get('url', ''),
                'paperCount': author.get('paperCount', 0),
                'citationCount': author.get('citationCount', 0),
                'hIndex': author.get('hIndex', 0)
            }]
            
            citation_json = f"\n[CITATION_METADATA]{json.dumps(citation_metadata)}[/CITATION_METADATA]"
            return result + citation_json
            
    except httpx.HTTPStatusError as e:
        return f"Error: Author not found (HTTP {e.response.status_code})"
    except Exception as e:
        return f"Error: {str(e)}"

# ============ TOOL 4: SEARCH AUTHORS ============
def search_authors(query: str, limit: int = 10) -> str:
    """
    Search for authors by name.
    
    Args:
        query: Author name to search for
        limit: Maximum number of results (default: 10, max: 100)
        
    Returns:
        Formatted string with author search results
    """
    try:
        base_url = "https://api.semanticscholar.org/graph/v1/author/search"
        limit = min(max(1, limit), 100)
        
        params = {
            "query": query,
            "limit": limit,
            "fields": "authorId,name,paperCount,citationCount,hIndex,affiliations"
        }
        
        headers = {'User-Agent': 'Mozilla/5.0'}
        
        with httpx.Client(timeout=15.0, headers=headers) as client:
            response = client.get(base_url, params=params)
            response.raise_for_status()
            
            data = response.json()
            authors = data.get('data', [])
            total = data.get('total', 0)
            
            if not authors:
                return f"No authors found for query '{query}'."
            
            result = f"Found {total} authors (showing {len(authors)}):\n\n"
            
            for i, author in enumerate(authors, 1):
                result += f"{i}. {author.get('name', 'Unknown')}\n"
                result += f"   Author ID: {author.get('authorId')}\n"
                result += f"   Papers: {author.get('paperCount', 0)}, "
                result += f"Citations: {author.get('citationCount', 0)}, "
                result += f"h-index: {author.get('hIndex', 0)}\n"
                
                if author.get('affiliations'):
                    result += f"   Affiliations: {', '.join(author['affiliations'])}\n"
                result += "\n"
            
            citation_metadata = [{
                'authorId': a.get('authorId'),
                'name': a.get('name'),
                'paperCount': a.get('paperCount', 0),
                'citationCount': a.get('citationCount', 0),
                'hIndex': a.get('hIndex', 0)
            } for a in authors]
            
            citation_json = f"[CITATION_METADATA]{json.dumps(citation_metadata)}[/CITATION_METADATA]"
            return result + citation_json
            
    except Exception as e:
        return f"Error: {str(e)}"

# ============ TOOL 5: GET PAPER CITATIONS ============
def get_paper_citations(paper_id: str, limit: int = 10) -> str:
    """
    Get papers that cite this paper.
    
    Args:
        paper_id: Semantic Scholar paper ID
        limit: Maximum number of citations to return (default: 10, max: 100)
        
    Returns:
        Formatted string with citing papers
    """
    try:
        base_url = f"https://api.semanticscholar.org/graph/v1/paper/{paper_id}/citations"
        limit = min(max(1, limit), 100)
        
        params = {
            "limit": limit,
            "fields": "paperId,title,year,authors,citationCount,url"
        }
        
        headers = {'User-Agent': 'Mozilla/5.0'}
        
        with httpx.Client(timeout=15.0, headers=headers) as client:
            response = client.get(base_url, params=params)
            response.raise_for_status()
            
            data = response.json()
            citations = data.get('data', [])
            
            if not citations:
                return f"No citations found for this paper."
            
            result = f"Papers citing this paper (showing {len(citations)}):\n\n"
            
            citation_metadata = []
            
            for i, item in enumerate(citations, 1):
                citing_paper = item.get('citingPaper', {})
                result += f"{i}. {citing_paper.get('title', 'Untitled')}\n"
                result += f"   Year: {citing_paper.get('year', 'N/A')}, "
                result += f"Citations: {citing_paper.get('citationCount', 0)}\n"
                
                authors = citing_paper.get('authors', [])
                if authors:
                    author_names = [a.get('name', '') for a in authors[:3]]
                    result += f"   Authors: {', '.join(author_names)}\n"
                
                if citing_paper.get('url'):
                    result += f"   URL: {citing_paper['url']}\n"
                result += "\n"
                
                citation_metadata.append({
                    'paperId': citing_paper.get('paperId'),
                    'title': citing_paper.get('title'),
                    'year': citing_paper.get('year'),
                    'url': citing_paper.get('url', '')
                })
            
            citation_json = f"[CITATION_METADATA]{json.dumps(citation_metadata)}[/CITATION_METADATA]"
            return result + citation_json
            
    except Exception as e:
        return f"Error: {str(e)}"

# ============ TOOL 6: GET PAPER REFERENCES ============
def get_paper_references(paper_id: str, limit: int = 10) -> str:
    """
    Get papers that this paper references (bibliography).
    
    Args:
        paper_id: Semantic Scholar paper ID
        limit: Maximum number of references to return (default: 10, max: 100)
        
    Returns:
        Formatted string with referenced papers
    """
    try:
        base_url = f"https://api.semanticscholar.org/graph/v1/paper/{paper_id}/references"
        limit = min(max(1, limit), 100)
        
        params = {
            "limit": limit,
            "fields": "paperId,title,year,authors,citationCount,url"
        }
        
        headers = {'User-Agent': 'Mozilla/5.0'}
        
        with httpx.Client(timeout=15.0, headers=headers) as client:
            response = client.get(base_url, params=params)
            response.raise_for_status()
            
            data = response.json()
            references = data.get('data', [])
            
            if not references:
                return f"No references found for this paper."
            
            result = f"Papers referenced by this paper (showing {len(references)}):\n\n"
            
            citation_metadata = []
            
            for i, item in enumerate(references, 1):
                cited_paper = item.get('citedPaper', {})
                result += f"{i}. {cited_paper.get('title', 'Untitled')}\n"
                result += f"   Year: {cited_paper.get('year', 'N/A')}, "
                result += f"Citations: {cited_paper.get('citationCount', 0)}\n"
                
                authors = cited_paper.get('authors', [])
                if authors:
                    author_names = [a.get('name', '') for a in authors[:3]]
                    result += f"   Authors: {', '.join(author_names)}\n"
                
                if cited_paper.get('url'):
                    result += f"   URL: {cited_paper['url']}\n"
                result += "\n"
                
                citation_metadata.append({
                    'paperId': cited_paper.get('paperId'),
                    'title': cited_paper.get('title'),
                    'year': cited_paper.get('year'),
                    'url': cited_paper.get('url', '')
                })
            
            citation_json = f"[CITATION_METADATA]{json.dumps(citation_metadata)}[/CITATION_METADATA]"
            return result + citation_json
            
    except Exception as e:
        return f"Error: {str(e)}"

# ============ TOOL 7: GET RECOMMENDED PAPERS ============
def get_recommended_papers(paper_id: str, limit: int = 10) -> str:
    """
    Get papers recommended based on a seed paper.
    
    Args:
        paper_id: Semantic Scholar paper ID to base recommendations on
        limit: Maximum number of recommendations (default: 10, max: 100)
        
    Returns:
        Formatted string with recommended papers
    """
    try:
        base_url = f"https://api.semanticscholar.org/recommendations/v1/papers/forpaper/{paper_id}"
        limit = min(max(1, limit), 100)
        
        params = {
            "limit": limit,
            "fields": "paperId,title,abstract,year,authors,citationCount,url"
        }
        
        headers = {'User-Agent': 'Mozilla/5.0'}
        
        with httpx.Client(timeout=15.0, headers=headers) as client:
            response = client.get(base_url, params=params)
            response.raise_for_status()
            
            data = response.json()
            papers = data.get('recommendedPapers', [])
            
            if not papers:
                return f"No recommendations found."
            
            result = f"Recommended papers (showing {len(papers)}):\n\n"
            
            citation_metadata = []
            
            for i, paper in enumerate(papers, 1):
                result += f"{i}. {paper.get('title', 'Untitled')}\n"
                result += f"   Year: {paper.get('year', 'N/A')}, "
                result += f"Citations: {paper.get('citationCount', 0)}\n"
                
                authors = paper.get('authors', [])
                if authors:
                    author_names = [a.get('name', '') for a in authors[:3]]
                    result += f"   Authors: {', '.join(author_names)}\n"
                
                if paper.get('url'):
                    result += f"   URL: {paper['url']}\n"
                
                if paper.get('abstract'):
                    abstract = paper['abstract']
                    if len(abstract) > 200:
                        abstract = abstract[:200] + "..."
                    result += f"   Abstract: {abstract}\n"
                result += "\n"
                
                citation_metadata.append({
                    'paperId': paper.get('paperId'),
                    'title': paper.get('title'),
                    'year': paper.get('year'),
                    'url': paper.get('url', ''),
                    'abstract': paper.get('abstract', '')
                })
            
            citation_json = f"[CITATION_METADATA]{json.dumps(citation_metadata)}[/CITATION_METADATA]"
            return result + citation_json
            
    except Exception as e:
        return f"Error: {str(e)}"

# ============ TOOL 8: GET AUTHOR PAPERS ============
def get_author_papers(author_id: str, limit: int = 20) -> str:
    """
    Get all papers by a specific author.
    
    Args:
        author_id: Semantic Scholar author ID
        limit: Maximum number of papers to return (default: 20, max: 100)
        
    Returns:
        Formatted string with author's papers
    """
    try:
        base_url = f"https://api.semanticscholar.org/graph/v1/author/{author_id}/papers"
        limit = min(max(1, limit), 100)
        
        params = {
            "limit": limit,
            "fields": "paperId,title,year,citationCount,venue,url"
        }
        
        headers = {'User-Agent': 'Mozilla/5.0'}
        
        with httpx.Client(timeout=15.0, headers=headers) as client:
            response = client.get(base_url, params=params)
            response.raise_for_status()
            
            data = response.json()
            papers = data.get('data', [])
            
            if not papers:
                return f"No papers found for this author."
            
            result = f"Papers by this author (showing {len(papers)}):\n\n"
            
            citation_metadata = []
            
            for i, paper in enumerate(papers, 1):
                result += f"{i}. {paper.get('title', 'Untitled')}\n"
                result += f"   Year: {paper.get('year', 'N/A')}, "
                result += f"Citations: {paper.get('citationCount', 0)}\n"
                
                if paper.get('venue'):
                    result += f"   Venue: {paper['venue']}\n"
                
                if paper.get('url'):
                    result += f"   URL: {paper['url']}\n"
                result += "\n"
                
                citation_metadata.append({
                    'paperId': paper.get('paperId'),
                    'title': paper.get('title'),
                    'year': paper.get('year'),
                    'url': paper.get('url', '')
                })
            
            citation_json = f"[CITATION_METADATA]{json.dumps(citation_metadata)}[/CITATION_METADATA]"
            return result + citation_json
            
    except Exception as e:
        return f"Error: {str(e)}"
