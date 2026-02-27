from app.utils.qdrant_client import qdrant_manager
from app.models import PaperDocument, DocumentChunk
from app.database import SessionLocal
import json
import logging

logger = logging.getLogger(__name__)


def search_paper_rag(query: str, document_id: int, limit: int = 10) -> str:
    """
    Search for relevant content in a specific paper document using RAG (Retrieval-Augmented Generation).
    
    Args:
        query: The search query or question
        document_id: ID of the paper document to search in
        limit: Maximum number of relevant chunks to return (default: 10)
    
    Returns:
        JSON string containing relevant document chunks with citations
    """
    try:
        db = SessionLocal()
        
        # Get document info
        document = db.query(PaperDocument).filter(
            PaperDocument.id == document_id,
            PaperDocument.processing_status == "completed"
        ).first()
        
        if not document:
            return json.dumps({
                "error": "Document not found or not ready for search",
                "chunks": []
            })
        
        # Search in Qdrant
        search_results = qdrant_manager.search_similar(
            collection_name=document.qdrant_collection_name,
            query=query,
            limit=limit,
            document_id=document_id
        )
        
        if not search_results:
            return json.dumps({
                "message": "No relevant content found for the query",
                "chunks": []
            })
        
        # Format results with citation metadata
        chunks = []
        citation_metadata = []
        
        for i, result in enumerate(search_results):
            chunk_data = {
                "index": i + 1,
                "content": result['content'],
                "page_number": result.get('page_number'),
                "start_char": result.get('start_char'),
                "end_char": result.get('end_char'),
                "page_start_char": result.get('page_start_char'),
                "page_end_char": result.get('page_end_char'),
                "anchor_start": result.get('anchor_start'),
                "anchor_end": result.get('anchor_end'),
                "anchor_middle": result.get('anchor_middle'),
                "relevance_score": round(result['score'], 3)
            }
            chunks.append(chunk_data)
            
            # Prepare citation metadata
            citation_metadata.append({
                "index": i + 1,
                "content": result['content'],
                "page_number": result.get('page_number'),
                "start_char": result.get('start_char'),
                "end_char": result.get('end_char'),
                "page_start_char": result.get('page_start_char'),
                "page_end_char": result.get('page_end_char'),
                "anchor_start": result.get('anchor_start'),
                "anchor_end": result.get('anchor_end'),
                "anchor_middle": result.get('anchor_middle'),
                "score": result['score'],
                "document_title": document.title or document.file_name
            })
        
        # Create response with citation metadata
        response_data = {
            "document_title": document.title or document.file_name,
            "query": query,
            "chunks": chunks,
            "total_found": len(chunks)
        }
        
        # Add citation metadata for frontend processing
        citation_json = json.dumps(citation_metadata)
        response_text = json.dumps(response_data, indent=2)
        
        # Append citation metadata that will be extracted by the agent
        response_with_citations = f"{response_text}\n\n[CITATION_METADATA]{citation_json}[/CITATION_METADATA]"
        
        db.close()
        return response_with_citations
        
    except Exception as e:
        logger.error(f"Error in search_paper_rag: {e}")
        if 'db' in locals():
            db.close()
        return json.dumps({
            "error": f"Search failed: {str(e)}",
            "chunks": []
        })

# The function is ready to be used directly as a tool
