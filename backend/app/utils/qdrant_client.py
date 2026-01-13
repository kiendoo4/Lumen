from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from sentence_transformers import SentenceTransformer
from app.config import settings
import uuid
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class QdrantManager:
    def __init__(self):
        self.client = QdrantClient(
            host=settings.qdrant_host,
            port=settings.qdrant_port,
            api_key=settings.qdrant_api_key
        )
        self.embedding_model = SentenceTransformer(settings.embedding_model)
        
    def create_collection(self, collection_name: str, vector_size: int = None) -> bool:
        """Create a new collection in Qdrant
        
        Args:
            collection_name: Name of the collection
            vector_size: Size of vectors. If None, will be determined from the embedding model.
        """
        try:
            # If vector_size not provided, get it from the embedding model
            if vector_size is None:
                # Get embedding dimension from the model
                # intfloat/multilingual-e5-large-instruct produces 1024-dimensional vectors
                sample_embedding = self.embed_text("sample")
                if sample_embedding:
                    vector_size = len(sample_embedding)
                else:
                    # Fallback to 1024 for intfloat/multilingual-e5-large-instruct
                    vector_size = 1024
            
            self.client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
            )
            logger.info(f"Created collection: {collection_name} with vector size: {vector_size}")
            return True
        except Exception as e:
            logger.error(f"Error creating collection {collection_name}: {e}")
            return False
    
    def delete_collection(self, collection_name: str) -> bool:
        """Delete a collection from Qdrant"""
        try:
            self.client.delete_collection(collection_name=collection_name)
            logger.info(f"Deleted collection: {collection_name}")
            return True
        except Exception as e:
            logger.error(f"Error deleting collection {collection_name}: {e}")
            return False
    
    def collection_exists(self, collection_name: str) -> bool:
        """Check if collection exists"""
        try:
            collections = self.client.get_collections()
            return any(col.name == collection_name for col in collections.collections)
        except Exception as e:
            logger.error(f"Error checking collection existence {collection_name}: {e}")
            return False
    
    def embed_text(self, text: str) -> List[float]:
        """Generate embedding for text"""
        try:
            embedding = self.embedding_model.encode(text)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            return []
    
    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        try:
            embeddings = self.embedding_model.encode(texts)
            return [emb.tolist() for emb in embeddings]
        except Exception as e:
            logger.error(f"Error generating embeddings: {e}")
            return []
    
    def add_documents(self, collection_name: str, documents: List[Dict[str, Any]]) -> List[str]:
        """Add documents to collection
        
        Args:
            collection_name: Name of the collection
            documents: List of documents with 'content' and metadata
            
        Returns:
            List of point IDs
        """
        try:
            # Generate embeddings for all documents
            texts = [doc['content'] for doc in documents]
            embeddings = self.embed_texts(texts)
            
            if not embeddings:
                logger.error("Failed to generate embeddings")
                return []
            
            # Create points
            points = []
            point_ids = []
            
            for i, (doc, embedding) in enumerate(zip(documents, embeddings)):
                point_id = str(uuid.uuid4())
                point_ids.append(point_id)
                
                payload = {
                    'content': doc['content'],
                    'document_id': doc.get('document_id'),
                    'chunk_index': doc.get('chunk_index'),
                    'page_number': doc.get('page_number'),
                    'start_char': doc.get('start_char'),
                    'end_char': doc.get('end_char'),
                }
                
                points.append(PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload=payload
                ))
            
            # Upload points to Qdrant
            self.client.upsert(
                collection_name=collection_name,
                points=points
            )
            
            logger.info(f"Added {len(points)} documents to collection {collection_name}")
            return point_ids
            
        except Exception as e:
            logger.error(f"Error adding documents to collection {collection_name}: {e}")
            return []
    
    def search_similar(self, collection_name: str, query: str, limit: int = 5, 
                      document_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Search for similar documents
        
        Args:
            collection_name: Name of the collection
            query: Search query
            limit: Number of results to return
            document_id: Filter by specific document ID
            
        Returns:
            List of similar documents with scores
        """
        try:
            # Generate embedding for query
            query_embedding = self.embed_text(query)
            if not query_embedding:
                logger.error("Failed to generate query embedding")
                return []
            
            # Prepare filter if document_id is specified
            query_filter = None
            if document_id:
                query_filter = Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(value=document_id)
                        )
                    ]
                )
            
            # Search in Qdrant using query_points (correct API according to Qdrant docs)
            search_results = self.client.query_points(
                collection_name=collection_name,
                query=query_embedding,
                query_filter=query_filter,
                limit=limit,
                with_payload=True
            )
            
            # Format results
            results = []
            for result in search_results.points:
                results.append({
                    'id': result.id,
                    'score': result.score,
                    'content': result.payload.get('content', '') if result.payload else '',
                    'document_id': result.payload.get('document_id') if result.payload else None,
                    'chunk_index': result.payload.get('chunk_index') if result.payload else None,
                    'page_number': result.payload.get('page_number') if result.payload else None,
                    'start_char': result.payload.get('start_char') if result.payload else None,
                    'end_char': result.payload.get('end_char') if result.payload else None,
                })
            
            logger.info(f"Found {len(results)} similar documents for query")
            return results
            
        except Exception as e:
            logger.error(f"Error searching in collection {collection_name}: {e}")
            return []
    
    def delete_document_chunks(self, collection_name: str, document_id: int) -> bool:
        """Delete all chunks for a specific document"""
        try:
            # Delete points with matching document_id
            self.client.delete(
                collection_name=collection_name,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(value=document_id)
                        )
                    ]
                )
            )
            logger.info(f"Deleted chunks for document {document_id} from collection {collection_name}")
            return True
        except Exception as e:
            logger.error(f"Error deleting document chunks: {e}")
            return False

# Global instance
qdrant_manager = QdrantManager()
