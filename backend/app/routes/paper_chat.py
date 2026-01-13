from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.models import PaperDocument, DocumentChunk, PaperChatSession, PaperChatMessage
from app.middleware.auth import get_current_user
from app.utils.minio_client import minio_client
from app.utils.document_processor import document_processor
from app.utils.qdrant_client import qdrant_manager
from app.utils.litellm_client import get_llm_config
from app.schemas import PaperChatSessionCreate, PaperChatSessionUpdate, PaperChatMessageCreate
from app.agent.paper_chat_agent import call_paper_chat_agent
from pydantic import BaseModel
from typing import List, Optional
import os
import uuid
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/paper-chat", tags=["paper-chat"])

class DocumentUploadResponse(BaseModel):
    document_id: int
    file_name: str
    processing_status: str
    message: str

class PaperChatSessionResponse(BaseModel):
    id: int
    title: str
    document_id: int
    document_title: str
    llm_model: str
    temperature: float
    created_at: str

class PaperChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    citations: Optional[List[dict]]
    created_at: str

class ChatRequest(BaseModel):
    message: str
    llm_model: Optional[str] = "gpt-4"
    temperature: Optional[float] = 0.7

async def process_document_background(document_id: int, file_path: str, db: Session):
    """Background task to process document"""
    try:
        logger.info(f"Starting background processing for document {document_id}")
        
        # Update status to processing
        document = db.query(PaperDocument).filter(PaperDocument.id == document_id).first()
        if not document:
            logger.error(f"Document {document_id} not found")
            return
        
        document.processing_status = "processing"
        db.commit()
        
        # Process document
        chunks, metadata = document_processor.process_document(file_path)
        
        if not chunks:
            document.processing_status = "failed"
            db.commit()
            logger.error(f"Failed to process document {document_id}")
            return
        
        # Update document metadata
        document.title = metadata.get('title') or document.file_name
        document.authors = metadata.get('authors')
        document.abstract = metadata.get('abstract')
        document.total_pages = metadata.get('total_pages')
        
        # Create Qdrant collection
        collection_name = f"doc_{document_id}_{uuid.uuid4().hex[:8]}"
        document.qdrant_collection_name = collection_name
        
        if not qdrant_manager.create_collection(collection_name):
            document.processing_status = "failed"
            db.commit()
            logger.error(f"Failed to create Qdrant collection for document {document_id}")
            return
        
        # Prepare documents for Qdrant
        qdrant_docs = []
        for chunk in chunks:
            qdrant_docs.append({
                'content': chunk['content'],
                'document_id': document_id,
                'chunk_index': chunk['chunk_index'],
                'page_number': chunk.get('page_number'),
                'start_char': chunk['start_char'],
                'end_char': chunk['end_char']
            })
        
        # Add documents to Qdrant
        point_ids = qdrant_manager.add_documents(collection_name, qdrant_docs)
        
        if not point_ids:
            document.processing_status = "failed"
            db.commit()
            logger.error(f"Failed to add documents to Qdrant for document {document_id}")
            return
        
        # Save chunks to database
        for i, (chunk, point_id) in enumerate(zip(chunks, point_ids)):
            db_chunk = DocumentChunk(
                document_id=document_id,
                chunk_index=chunk['chunk_index'],
                content=chunk['content'],
                page_number=chunk.get('page_number'),
                start_char=chunk['start_char'],
                end_char=chunk['end_char'],
                qdrant_point_id=point_id
            )
            db.add(db_chunk)
        
        # Update status to completed
        document.processing_status = "completed"
        db.commit()
        
        logger.info(f"Successfully processed document {document_id} with {len(chunks)} chunks")
        
    except Exception as e:
        logger.error(f"Error processing document {document_id}: {e}")
        # Update status to failed
        try:
            document = db.query(PaperDocument).filter(PaperDocument.id == document_id).first()
            if document:
                document.processing_status = "failed"
                db.commit()
        except:
            pass

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload and process a document for paper chat"""
    
    # Validate file type
    allowed_types = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported file type. Only PDF, DOCX, and TXT files are allowed.")
    
    # Validate file size (max 50MB)
    if file.size > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 50MB.")
    
    try:
        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4().hex}{file_extension}"
        minio_path = f"papers/{current_user['userId']}/{unique_filename}"
        
        # Upload to MinIO
        file_content = await file.read()
        if not minio_client.upload_file(file_content, minio_path):
            raise HTTPException(status_code=500, detail="Failed to upload file to storage")
        
        # Create document record
        document = PaperDocument(
            user_id=current_user["userId"],
            file_name=file.filename,
            file_path=minio_path,
            file_type=file.content_type,
            file_size=file.size,
            processing_status="pending"
        )
        
        db.add(document)
        db.commit()
        db.refresh(document)
        
        # Get local file path for processing
        local_file_path = minio_client.download_file_to_temp(minio_path)
        if not local_file_path:
            raise HTTPException(status_code=500, detail="Failed to download file for processing")
        
        # Start background processing
        background_tasks.add_task(process_document_background, document.id, local_file_path, db)
        
        return DocumentUploadResponse(
            document_id=document.id,
            file_name=file.filename,
            processing_status="pending",
            message="Document uploaded successfully. Processing will begin shortly."
        )
        
    except Exception as e:
        logger.error(f"Error uploading document: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload document")

@router.get("/documents")
async def get_user_documents(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all documents for the current user"""
    documents = db.query(PaperDocument).filter(
        PaperDocument.user_id == current_user["userId"]
    ).order_by(PaperDocument.created_at.desc()).all()
    
    return [
        {
            "id": doc.id,
            "file_name": doc.file_name,
            "title": doc.title or doc.file_name,
            "authors": doc.authors,
            "abstract": doc.abstract,
            "total_pages": doc.total_pages,
            "processing_status": doc.processing_status,
            "created_at": doc.created_at.isoformat()
        }
        for doc in documents
    ]

@router.get("/documents/{document_id}/status")
async def get_document_status(
    document_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get processing status of a document"""
    document = db.query(PaperDocument).filter(
        PaperDocument.id == document_id,
        PaperDocument.user_id == current_user["userId"]
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {
        "document_id": document.id,
        "processing_status": document.processing_status,
        "title": document.title or document.file_name
    }

@router.post("/documents/{document_id}/sessions", response_model=PaperChatSessionResponse)
async def create_chat_session(
    document_id: int,
    session_data: PaperChatSessionCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new chat session for a document"""
    
    # Verify document exists and is processed
    document = db.query(PaperDocument).filter(
        PaperDocument.id == document_id,
        PaperDocument.user_id == current_user["userId"]
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if document.processing_status != "completed":
        raise HTTPException(status_code=400, detail="Document is not ready for chat. Please wait for processing to complete.")
    
    # Create chat session
    session = PaperChatSession(
        user_id=current_user["userId"],
        document_id=document_id,
        title=session_data.title,
        llm_model=session_data.llm_model,
        temperature=session_data.temperature,
        top_p=session_data.top_p,
        max_tokens=session_data.max_tokens
    )
    
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return PaperChatSessionResponse(
        id=session.id,
        title=session.title,
        document_id=document_id,
        document_title=document.title or document.file_name,
        llm_model=session.llm_model,
        temperature=float(session.temperature),
        created_at=session.created_at.isoformat()
    )

@router.get("/sessions")
async def get_user_chat_sessions(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all chat sessions for the current user"""
    sessions = db.query(PaperChatSession).join(PaperDocument).filter(
        PaperChatSession.user_id == current_user["userId"]
    ).order_by(PaperChatSession.updated_at.desc()).all()
    
    return [
        {
            "id": session.id,
            "title": session.title,
            "document_id": session.document_id,
            "document_title": session.document.title or session.document.file_name,
            "llm_model": session.llm_model,
            "temperature": float(session.temperature),
            "created_at": session.created_at.isoformat(),
            "updated_at": session.updated_at.isoformat()
        }
        for session in sessions
    ]

@router.get("/sessions/{session_id}")
async def get_session(
    session_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a chat session by ID"""
    
    # Verify session belongs to user
    session = db.query(PaperChatSession).filter(
        PaperChatSession.id == session_id,
        PaperChatSession.user_id == current_user["userId"]
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    return {
        "id": session.id,
        "title": session.title,
        "document_id": session.document_id,
        "document_title": session.document.title or session.document.file_name,
        "llm_model": session.llm_model,
        "temperature": float(session.temperature),
        "top_p": float(session.top_p),
        "max_tokens": session.max_tokens,
        "created_at": session.created_at.isoformat(),
        "updated_at": session.updated_at.isoformat()
    }

@router.put("/sessions/{session_id}")
async def update_session(
    session_id: int,
    session_data: PaperChatSessionUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a chat session"""
    
    # Verify session belongs to user
    session = db.query(PaperChatSession).filter(
        PaperChatSession.id == session_id,
        PaperChatSession.user_id == current_user["userId"]
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # Update session settings (only update fields that are provided)
    if session_data.title is not None:
        session.title = session_data.title
    if session_data.llm_model is not None:
        session.llm_model = session_data.llm_model
    if session_data.temperature is not None:
        session.temperature = session_data.temperature
    if session_data.top_p is not None:
        session.top_p = session_data.top_p
    if session_data.max_tokens is not None:
        session.max_tokens = session_data.max_tokens
    
    db.commit()
    db.refresh(session)
    
    return {
        "id": session.id,
        "title": session.title,
        "document_id": session.document_id,
        "document_title": session.document.title or session.document.file_name,
        "llm_model": session.llm_model,
        "temperature": float(session.temperature),
        "top_p": float(session.top_p),
        "max_tokens": session.max_tokens,
        "created_at": session.created_at.isoformat(),
        "updated_at": session.updated_at.isoformat()
    }

@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all messages for a chat session"""
    
    # Verify session belongs to user
    session = db.query(PaperChatSession).filter(
        PaperChatSession.id == session_id,
        PaperChatSession.user_id == current_user["userId"]
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    messages = db.query(PaperChatMessage).filter(
        PaperChatMessage.session_id == session_id
    ).order_by(PaperChatMessage.created_at.asc()).all()
    
    return [
        {
            "id": msg.id,
            "role": msg.role.value,
            "content": msg.content,
            "citations": msg.citations,
            "reasoning": msg.reasoning,
            "created_at": msg.created_at.isoformat()
        }
        for msg in messages
    ]

@router.post("/sessions/{session_id}/chat")
async def chat_with_paper(
    session_id: int,
    chat_request: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Chat with a paper using RAG"""
    
    # Verify session belongs to user
    session = db.query(PaperChatSession).join(PaperDocument).filter(
        PaperChatSession.id == session_id,
        PaperChatSession.user_id == current_user["userId"]
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    if session.document.processing_status != "completed":
        raise HTTPException(status_code=400, detail="Document is not ready for chat")
    
    try:
        # Save user message
        user_message = PaperChatMessage(
            session_id=session_id,
            role="user",
            content=chat_request.message
        )
        db.add(user_message)
        db.commit()
        
        # Prepare messages for the paper chat agent
        # Get conversation history
        existing_messages = db.query(PaperChatMessage).filter(
            PaperChatMessage.session_id == session_id
        ).order_by(PaperChatMessage.created_at.asc()).all()
        
        messages = []
        for msg in existing_messages[:-1]:  # Exclude the user message we just added
            messages.append({
                "role": msg.role.value,
                "content": msg.content
            })
        
        # Add the current user message
        messages.append({
            "role": "user", 
            "content": chat_request.message
        })
        
        # Determine provider and get API key
        model = chat_request.llm_model or session.llm_model
        model_lower = model.lower()
        user_id = current_user["userId"]
        
        if "gemini" in model_lower or model.startswith("google"):
            provider = "gemini"
            llm_factory = "gemini"
            llm_name = model.replace("gemini/", "") if model.startswith("gemini/") else model
        elif model.startswith("ollama") or model.startswith("llama") or model.startswith("mistral") or model.startswith("codellama") or model.startswith("phi"):
            provider = "ollama"
            llm_factory = "ollama"
            llm_name = model
        else:
            provider = "openai"
            llm_factory = "openai"
            llm_name = model
        
        # Get API key from database
        config = await get_llm_config(user_id, provider)
        if not config:
            raise HTTPException(
                status_code=400,
                detail=f"{provider.capitalize()} API key not found. Please configure {provider} provider in settings."
            )
        
        api_key = config.get("api_key")
        if not api_key and provider != "ollama":
            raise HTTPException(
                status_code=400,
                detail=f"{provider.capitalize()} API key not found. Please configure {provider} provider in settings."
            )
        
        # Get LLM configuration
        llm_config = {
            "llm_factory": llm_factory,
            "llm_name": llm_name,
            "api_key": api_key
        }
        
        # Call paper chat agent with RAG
        response, reasoning_steps, citations, url_contents = await call_paper_chat_agent(
            llm_config, 
            messages, 
            session.document_id,
            session.document.title or session.document.file_name,
current_user.get("timezone", "UTC")
        )
        
        # Save agent response
        agent_message = PaperChatMessage(
            session_id=session_id,
            role="agent",
            content=response,
            reasoning=reasoning_steps,
            citations=citations
        )
        db.add(agent_message)
        
        # Update session timestamp
        session.updated_at = db.execute(text("SELECT NOW()")).scalar()
        db.commit()
        
        return {
            "message": response,
            "citations": citations,
            "reasoning": reasoning_steps
        }
        
    except Exception as e:
        logger.error(f"Error in chat with paper: {e}")
        raise HTTPException(status_code=500, detail="Failed to process chat request")

@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a document and all associated data"""
    
    document = db.query(PaperDocument).filter(
        PaperDocument.id == document_id,
        PaperDocument.user_id == current_user["userId"]
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        # Delete from Qdrant if collection exists
        if document.qdrant_collection_name:
            qdrant_manager.delete_collection(document.qdrant_collection_name)
        
        # Delete from MinIO
        minio_client.delete_file(document.file_path)
        
        # Delete from database (cascades to chunks and chat sessions)
        db.delete(document)
        db.commit()
        
        return {"message": "Document deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting document {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete document")

@router.get("/documents/{document_id}/url")
async def get_document_url(
    document_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get presigned URL for document viewing"""
    
    document = db.query(PaperDocument).filter(
        PaperDocument.id == document_id,
        PaperDocument.user_id == current_user["userId"]
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        # Generate presigned URL for 1 hour
        url = minio_client.get_file_url(document.file_path, expires_in_seconds=3600)
        
        if not url:
            raise HTTPException(status_code=500, detail="Failed to generate document URL")
        
        return {"url": url}
        
    except Exception as e:
        logger.error(f"Error generating document URL: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate document URL")

@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a chat session"""
    
    session = db.query(PaperChatSession).filter(
        PaperChatSession.id == session_id,
        PaperChatSession.user_id == current_user["userId"]
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    try:
        db.delete(session)
        db.commit()
        return {"message": "Chat session deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting chat session {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete chat session")
