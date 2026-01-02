from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Message, Dialog, Conversation, RoleEnum
from app.middleware.auth import get_current_user
from app.schemas import MessageResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union

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
    reasoning: Optional[Union[Dict[str, Any], List[Any]]] = None
    confidence: Optional[str] = None
    sources: Optional[Union[Dict[str, Any], List[Any]]] = None

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
    
    # Convert role string to RoleEnum
    try:
        role_enum = RoleEnum(message_data.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {message_data.role}. Must be 'user' or 'agent'"
        )
    
    # Convert reasoning and sources from list to dict if needed
    # Backend stores as JSON, so we can store either format
    reasoning = message_data.reasoning
    sources = message_data.sources
    
    # If reasoning is a list, convert to dict with 'steps' key
    if isinstance(reasoning, list):
        reasoning = {"steps": reasoning} if reasoning else None
    
    # If sources is a list, convert to dict with 'items' key
    if isinstance(sources, list):
        sources = {"items": sources} if sources else None
    
    new_message = Message(
        dialog_id=dialog_id,
        role=role_enum,
        content=message_data.content,
        reasoning=reasoning,
        confidence=message_data.confidence,
        sources=sources
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

@router.delete("/{message_id}")
async def delete_message(
    message_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify ownership through dialog -> conversation
    message = db.query(Message).join(Dialog).join(Conversation).filter(
        Message.id == message_id,
        Conversation.user_id == current_user["userId"]
    ).first()
    
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    
    # Only allow deleting user messages (not agent messages)
    if message.role.value != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Only user messages can be deleted"
        )
    
    db.delete(message)
    db.commit()
    
    return {"message": "Message deleted successfully"}

