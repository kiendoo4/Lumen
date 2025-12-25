from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Message, Dialog, Conversation
from app.middleware.auth import get_current_user
from app.schemas import MessageResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

router = APIRouter()

@router.get("/dialog/{dialog_id}", response_model=List[MessageResponse])
async def get_messages(
    dialog_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify ownership
    dialog = db.query(Dialog).join(Conversation).filter(
        Dialog.id == dialog_id,
        Conversation.user_id == current_user["userId"]
    ).first()
    
    if not dialog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dialog not found")
    
    messages = db.query(Message).filter(
        Message.dialog_id == dialog_id
    ).order_by(Message.created_at.asc()).all()
    
    return [MessageResponse(
        id=m.id,
        role=m.role.value,
        content=m.content,
        reasoning=m.reasoning,
        confidence=m.confidence,
        sources=m.sources,
        created_at=m.created_at
    ) for m in messages]

class MessageCreate(BaseModel):
    role: str
    content: Optional[str] = None
    reasoning: Optional[Dict[str, Any]] = None
    confidence: Optional[str] = None
    sources: Optional[Dict[str, Any]] = None

@router.post("/dialog/{dialog_id}", response_model=MessageResponse)
async def create_message(
    dialog_id: int,
    message_data: MessageCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify ownership
    dialog = db.query(Dialog).join(Conversation).filter(
        Dialog.id == dialog_id,
        Conversation.user_id == current_user["userId"]
    ).first()
    
    if not dialog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dialog not found")
    
    new_message = Message(
        dialog_id=dialog_id,
        role=message_data.role,
        content=message_data.content,
        reasoning=message_data.reasoning,
        confidence=message_data.confidence,
        sources=message_data.sources
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    return MessageResponse(
        id=new_message.id,
        role=new_message.role.value,
        content=new_message.content,
        reasoning=new_message.reasoning,
        confidence=new_message.confidence,
        sources=new_message.sources,
        created_at=new_message.created_at
    )

