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
                llm_model=conv.llm_model,  # Get from conversation
                freedom=conv.freedom,
                temperature=conv.temperature,
                top_p=conv.top_p,
                presence_penalty=conv.presence_penalty,
                frequency_penalty=conv.frequency_penalty,
                max_tokens=conv.max_tokens,
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
    llm_model: Optional[str] = Form(None),
    freedom: Optional[float] = Form(None),
    temperature: Optional[float] = Form(None),
    top_p: Optional[float] = Form(None),
    presence_penalty: Optional[float] = Form(None),
    frequency_penalty: Optional[float] = Form(None),
    max_tokens: Optional[int] = Form(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    avatar_url = None
    
    if avatar:
        file_path = f"conversations/{current_user['userId']}/{avatar.filename}"
        file_data = await avatar.read()
        upload_file(file_data, file_path, avatar.content_type or "image/jpeg")
        avatar_url = f"/api/files/{file_path}"
    
    conversation_title = title or "New Conversation"
    # Config is stored in conversation, not in individual dialogs
    new_conv = Conversation(
        user_id=current_user["userId"],
        title=conversation_title,
        avatar_url=avatar_url,
        llm_model=llm_model or "gpt-4",
        freedom=freedom if freedom is not None else 0.5,
        temperature=temperature if temperature is not None else 0.7,
        top_p=top_p if top_p is not None else 0.9,
        presence_penalty=presence_penalty if presence_penalty is not None else 0.0,
        frequency_penalty=frequency_penalty if frequency_penalty is not None else 0.0,
        max_tokens=max_tokens if max_tokens is not None else 2000
    )
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    
    # Automatically create the first dialog for this conversation
    # Dialog inherits config from conversation (no config fields needed)
    from app.models import Dialog
    new_dialog = Dialog(
        conversation_id=new_conv.id,
        title="New Dialog"
    )
    db.add(new_dialog)
    db.commit()
    db.refresh(new_dialog)
    
    from app.schemas import DialogResponse
    return ConversationResponse(
        id=new_conv.id,
        title=new_conv.title,
        avatar_url=new_conv.avatar_url,
        created_at=new_conv.created_at,
        updated_at=new_conv.updated_at,
        dialog_count=1,
        dialogs=[DialogResponse(
            id=new_dialog.id,
            title=new_dialog.title,
            llm_model=new_conv.llm_model,  # Get from conversation
            freedom=new_conv.freedom,
            temperature=new_conv.temperature,
            top_p=new_conv.top_p,
            presence_penalty=new_conv.presence_penalty,
            frequency_penalty=new_conv.frequency_penalty,
            max_tokens=new_conv.max_tokens,
            created_at=new_dialog.created_at,
            updated_at=new_dialog.updated_at,
            message_count=0,
            sources=[]
        )]
    )

@router.put("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: int,
    title: Optional[str] = Form(None),
    avatar: Optional[UploadFile] = File(None),
    llm_model: Optional[str] = Form(None),
    freedom: Optional[float] = Form(None),
    temperature: Optional[float] = Form(None),
    top_p: Optional[float] = Form(None),
    presence_penalty: Optional[float] = Form(None),
    frequency_penalty: Optional[float] = Form(None),
    max_tokens: Optional[int] = Form(None),
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
    
    # Update config (config belongs to conversation)
    if llm_model:
        conv.llm_model = llm_model
    if freedom is not None:
        conv.freedom = freedom
    if temperature is not None:
        conv.temperature = temperature
    if top_p is not None:
        conv.top_p = top_p
    if presence_penalty is not None:
        conv.presence_penalty = presence_penalty
    if frequency_penalty is not None:
        conv.frequency_penalty = frequency_penalty
    if max_tokens is not None:
        conv.max_tokens = max_tokens
    
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

