from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Dialog, Conversation, DialogSource, SourceTypeEnum
from app.schemas import DialogCreate, DialogUpdate, DialogResponse, DialogSourceCreate, DialogSourceResponse
from app.middleware.auth import get_current_user
from app.utils.minio_client import minio_client, BUCKET_NAME, upload_file
from typing import List, Optional
from datetime import datetime

router = APIRouter()

@router.get("/conversation/{conversation_id}", response_model=list[DialogResponse])
async def get_dialogs(
    conversation_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify ownership
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user["userId"]
    ).first()
    
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    
    dialogs = db.query(Dialog).filter(
        Dialog.conversation_id == conversation_id
    ).order_by(Dialog.updated_at.desc()).all()
    
    result = []
    from app.models import Message
    for dialog in dialogs:
        message_count = db.query(func.count(Message.id)).filter(Message.dialog_id == dialog.id).scalar()
        sources = db.query(DialogSource).filter(DialogSource.dialog_id == dialog.id).all()
        
        result.append(DialogResponse(
            id=dialog.id,
            title=dialog.title,
            llm_model=dialog.llm_model,
            freedom=dialog.freedom,
            temperature=dialog.temperature,
            top_p=dialog.top_p,
            presence_penalty=dialog.presence_penalty,
            frequency_penalty=dialog.frequency_penalty,
            max_tokens=dialog.max_tokens,
            created_at=dialog.created_at,
            updated_at=dialog.updated_at,
            message_count=message_count,
            sources=[DialogSourceResponse(
                id=s.id,
                file_name=s.file_name,
                source_type=s.source_type.value,
                source_value=s.source_value
            ) for s in sources]
        ))
    
    return result

@router.post("/conversation/{conversation_id}", response_model=DialogResponse)
async def create_dialog(
    conversation_id: int,
    dialog_data: DialogCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify ownership
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user["userId"]
    ).first()
    
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    
    new_dialog = Dialog(
        conversation_id=conversation_id,
        title=dialog_data.title or "New Dialog",
        llm_model=dialog_data.llm_model or "gpt-4",
        freedom=dialog_data.freedom or 0.5,
        temperature=dialog_data.temperature or 0.7,
        top_p=dialog_data.top_p or 0.9,
        presence_penalty=dialog_data.presence_penalty or 0.0,
        frequency_penalty=dialog_data.frequency_penalty or 0.0,
        max_tokens=dialog_data.max_tokens or 2000
    )
    db.add(new_dialog)
    db.commit()
    db.refresh(new_dialog)
    
    return DialogResponse(
        id=new_dialog.id,
        title=new_dialog.title,
        llm_model=new_dialog.llm_model,
        freedom=new_dialog.freedom,
        temperature=new_dialog.temperature,
        top_p=new_dialog.top_p,
        presence_penalty=new_dialog.presence_penalty,
        frequency_penalty=new_dialog.frequency_penalty,
        max_tokens=new_dialog.max_tokens,
        created_at=new_dialog.created_at,
        updated_at=new_dialog.updated_at,
        message_count=0,
        sources=[]
    )

@router.put("/{dialog_id}", response_model=DialogResponse)
async def update_dialog(
    dialog_id: int,
    dialog_data: DialogUpdate,
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
    
    if dialog_data.title:
        dialog.title = dialog_data.title
    if dialog_data.llm_model:
        dialog.llm_model = dialog_data.llm_model
    if dialog_data.freedom is not None:
        dialog.freedom = dialog_data.freedom
    if dialog_data.temperature is not None:
        dialog.temperature = dialog_data.temperature
    if dialog_data.top_p is not None:
        dialog.top_p = dialog_data.top_p
    if dialog_data.presence_penalty is not None:
        dialog.presence_penalty = dialog_data.presence_penalty
    if dialog_data.frequency_penalty is not None:
        dialog.frequency_penalty = dialog_data.frequency_penalty
    if dialog_data.max_tokens is not None:
        dialog.max_tokens = dialog_data.max_tokens
    
    db.commit()
    db.refresh(dialog)
    
    sources = db.query(DialogSource).filter(DialogSource.dialog_id == dialog.id).all()
    
    return DialogResponse(
        id=dialog.id,
        title=dialog.title,
        llm_model=dialog.llm_model,
        freedom=dialog.freedom,
        temperature=dialog.temperature,
        top_p=dialog.top_p,
        presence_penalty=dialog.presence_penalty,
        frequency_penalty=dialog.frequency_penalty,
        max_tokens=dialog.max_tokens,
        created_at=dialog.created_at,
        updated_at=dialog.updated_at,
        message_count=0,
        sources=[DialogSourceResponse(
            id=s.id,
            file_name=s.file_name,
            source_type=s.source_type.value,
            source_value=s.source_value
        ) for s in sources]
    )

@router.post("/{dialog_id}/sources", response_model=list[DialogSourceResponse])
async def add_sources(
    dialog_id: int,
    files: Optional[List[UploadFile]] = File(None),
    source_type: Optional[str] = None,
    source_value: Optional[str] = None,
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
    
    sources = []
    
    if files:
        for file in files:
            file_path = f"sources/{current_user['userId']}/{dialog_id}/{datetime.now().timestamp()}-{file.filename}"
            file_data = await file.read()
            upload_file(file_data, file_path, file.content_type or "application/octet-stream")
            
            new_source = DialogSource(
                dialog_id=dialog_id,
                file_name=file.filename,
                file_path=f"/api/files/{file_path}",
                file_type=file.content_type,
                file_size=len(file_data),
                source_type=SourceTypeEnum.file,
                source_value=file.filename
            )
            db.add(new_source)
            sources.append(new_source)
    
    if source_type and source_value:
        new_source = DialogSource(
            dialog_id=dialog_id,
            file_name=source_value,
            source_type=SourceTypeEnum(source_type),
            source_value=source_value
        )
        db.add(new_source)
        sources.append(new_source)
    
    db.commit()
    
    return [DialogSourceResponse(
        id=s.id,
        file_name=s.file_name,
        source_type=s.source_type.value,
        source_value=s.source_value
    ) for s in sources]

@router.delete("/{dialog_id}/sources/{source_id}")
async def delete_source(
    dialog_id: int,
    source_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify ownership
    source = db.query(DialogSource).join(Dialog).join(Conversation).filter(
        DialogSource.id == source_id,
        DialogSource.dialog_id == dialog_id,
        Conversation.user_id == current_user["userId"]
    ).first()
    
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    
    # Delete file from MinIO if exists
    if source.file_path:
        file_path = source.file_path.replace("/api/files/", "")
        try:
            minio_client.remove_object(BUCKET_NAME, file_path)
        except Exception as e:
            print(f"Error deleting file from MinIO: {e}")
    
    db.delete(source)
    db.commit()
    return {"message": "Source deleted"}

