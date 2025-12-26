from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Conversation, Dialog
from app.schemas import ConversationCreate, ConversationUpdate, ConversationResponse, DialogResponse
from app.middleware.auth import get_current_user
from app.utils.minio_client import minio_client, BUCKET_NAME, upload_file
from typing import Optional

router = APIRouter()

@router.get("/", response_model=list[ConversationResponse])
async def get_conversations(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conversations = db.query(Conversation).filter(
        Conversation.user_id == current_user["userId"]
    ).order_by(Conversation.updated_at.desc()).all()
    
    result = []
    for conv in conversations:
        dialog_count = db.query(func.count(Dialog.id)).filter(
            Dialog.conversation_id == conv.id
        ).scalar()
        
        dialogs = db.query(Dialog).filter(
            Dialog.conversation_id == conv.id
        ).order_by(Dialog.updated_at.desc()).all()
        
        result.append(ConversationResponse(
            id=conv.id,
            title=conv.title,
            avatar_url=conv.avatar_url,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            dialog_count=dialog_count,
            dialogs=[DialogResponse(
                id=d.id,
                title=d.title,
                llm_model=d.llm_model,
                freedom=d.freedom,
                temperature=d.temperature,
                top_p=d.top_p,
                presence_penalty=d.presence_penalty,
                frequency_penalty=d.frequency_penalty,
                max_tokens=d.max_tokens,
                created_at=d.created_at,
                updated_at=d.updated_at,
                message_count=0,
                sources=[]
            ) for d in dialogs]
        ))
    
    return result

@router.post("/", response_model=ConversationResponse)
async def create_conversation(
    title: Optional[str] = Form(None),
    avatar: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    avatar_url = None
    
    if avatar:
        file_path = f"conversations/{current_user['userId']}/{avatar.filename}"
        file_data = await avatar.read()
        upload_file(file_data, file_path, avatar.content_type or "image/jpeg")
        avatar_url = f"/api/files/{file_path}"
    
    new_conv = Conversation(
        user_id=current_user["userId"],
        title=title or "New Conversation",
        avatar_url=avatar_url
    )
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    
    return ConversationResponse(
        id=new_conv.id,
        title=new_conv.title,
        avatar_url=new_conv.avatar_url,
        created_at=new_conv.created_at,
        updated_at=new_conv.updated_at,
        dialog_count=0,
        dialogs=[]
    )

@router.put("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: int,
    title: Optional[str] = Form(None),
    avatar: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user["userId"]
    ).first()
    
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    
    if title:
        conv.title = title
    
    if avatar:
        file_path = f"conversations/{current_user['userId']}/{avatar.filename}"
        file_data = await avatar.read()
        upload_file(file_data, file_path, avatar.content_type or "image/jpeg")
        conv.avatar_url = f"/api/files/{file_path}"
    
    db.commit()
    db.refresh(conv)
    
    dialog_count = db.query(func.count(Dialog.id)).filter(
        Dialog.conversation_id == conv.id
    ).scalar()
    
    return ConversationResponse(
        id=conv.id,
        title=conv.title,
        avatar_url=conv.avatar_url,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        dialog_count=dialog_count,
        dialogs=[]
    )

@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user["userId"]
    ).first()
    
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    
    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted"}

