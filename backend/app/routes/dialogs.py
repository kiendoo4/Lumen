from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Dialog, Conversation, DialogSource, SourceTypeEnum, Message, LLMProvider, ProviderEnum
from app.schemas import DialogCreate, DialogUpdate, DialogResponse, DialogSourceCreate, DialogSourceResponse
from app.middleware.auth import get_current_user
from app.utils.minio_client import minio_client, BUCKET_NAME, upload_file
from app.utils.litellm_client import call_llm
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
            is_pinned=dialog.is_pinned or 0,
            llm_model=conv.llm_model,  # Get from conversation
            freedom=conv.freedom,
            temperature=conv.temperature,
            top_p=conv.top_p,
            presence_penalty=conv.presence_penalty,
            frequency_penalty=conv.frequency_penalty,
            max_tokens=conv.max_tokens,
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
    
    # Dialog config comes purely from conversation config.
    # We DO NOT allow per-dialog config overrides from the client.
    # Get config directly from conversation
    new_dialog = Dialog(
        conversation_id=conversation_id,
        title=dialog_data.title or "New Dialog"
        # No config fields - dialog inherits from conversation
    )
    db.add(new_dialog)
    db.commit()
    db.refresh(new_dialog)
    
    # Refresh conversation to get latest config
    db.refresh(conv)
    
    return DialogResponse(
        id=new_dialog.id,
        title=new_dialog.title,
        is_pinned=new_dialog.is_pinned or 0,
        llm_model=conv.llm_model,  # Get from conversation
        freedom=conv.freedom,
        temperature=conv.temperature,
        top_p=conv.top_p,
        presence_penalty=conv.presence_penalty,
        frequency_penalty=conv.frequency_penalty,
        max_tokens=conv.max_tokens,
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
    
    # Get conversation for config updates
    conversation = db.query(Conversation).filter(Conversation.id == dialog.conversation_id).first()
    
    # Update dialog title and is_pinned
    if dialog_data.title:
        dialog.title = dialog_data.title
    if dialog_data.is_pinned is not None:
        dialog.is_pinned = dialog_data.is_pinned
    
    # Config updates go to conversation, not individual dialog
    config_updated = False
    if dialog_data.llm_model:
        conversation.llm_model = dialog_data.llm_model
        config_updated = True
    if dialog_data.freedom is not None:
        conversation.freedom = dialog_data.freedom
        config_updated = True
    if dialog_data.temperature is not None:
        conversation.temperature = dialog_data.temperature
        config_updated = True
    if dialog_data.top_p is not None:
        conversation.top_p = dialog_data.top_p
        config_updated = True
    if dialog_data.presence_penalty is not None:
        conversation.presence_penalty = dialog_data.presence_penalty
        config_updated = True
    if dialog_data.frequency_penalty is not None:
        conversation.frequency_penalty = dialog_data.frequency_penalty
        config_updated = True
    if dialog_data.max_tokens is not None:
        conversation.max_tokens = dialog_data.max_tokens
        config_updated = True
    
    if config_updated:
        conversation.updated_at = func.now()
    
    db.commit()
    db.refresh(dialog)
    db.refresh(conversation)
    
    sources = db.query(DialogSource).filter(DialogSource.dialog_id == dialog.id).all()
    
    return DialogResponse(
        id=dialog.id,
        title=dialog.title,
        is_pinned=dialog.is_pinned or 0,
        llm_model=conversation.llm_model,  # Get from conversation
        freedom=conversation.freedom,
        temperature=conversation.temperature,
        top_p=conversation.top_p,
        presence_penalty=conversation.presence_penalty,
        frequency_penalty=conversation.frequency_penalty,
        max_tokens=conversation.max_tokens,
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
            minio_client.delete_file(file_path)
        except Exception as e:
            print(f"Error deleting file from MinIO: {e}")
    
    db.delete(source)
    db.commit()
    return {"message": "Source deleted"}

@router.delete("/{dialog_id}")
async def delete_dialog(
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
    
    db.delete(dialog)
    db.commit()
    return {"message": "Dialog deleted"}

@router.post("/{dialog_id}/auto-name", response_model=DialogResponse)
async def auto_name_dialog(
    dialog_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Automatically generate a name for the dialog based on the first user message and agent response.
    Only works if the dialog has exactly 2 messages (first exchange).
    """
    # Verify ownership
    dialog = db.query(Dialog).join(Conversation).filter(
        Dialog.id == dialog_id,
        Conversation.user_id == current_user["userId"]
    ).first()
    
    if not dialog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dialog not found")
    
    # Get all messages for this dialog
    messages = db.query(Message).filter(
        Message.dialog_id == dialog_id
    ).order_by(Message.created_at.asc()).all()
    
    # Only auto-name if this is the first exchange (exactly 2 messages: user + agent)
    if len(messages) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Auto-naming only works for the first message exchange (2 messages)"
        )
    
    user_message = messages[0] if messages[0].role.value == "user" else messages[1]
    agent_message = messages[1] if messages[1].role.value == "agent" else messages[0]
    
    if not user_message.content or not agent_message.content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Messages must have content to generate a name"
        )
    
    # Generate a short title using LLM
    try:
        user_id = current_user["userId"]
        
        # Choose a model for title generation (use a fast/cheap one)
        providers = db.query(LLMProvider).filter(LLMProvider.user_id == user_id).all()
        provider_set = {p.provider for p in providers}
        
        if ProviderEnum.openai in provider_set:
            title_model = "gpt-4o-mini"
        elif ProviderEnum.gemini in provider_set:
            title_model = "gemini-2.5-flash"
        elif ProviderEnum.groq in provider_set:
            title_model = "groq/llama-3.1-8b-instant"
        elif ProviderEnum.ollama in provider_set:
            title_model = "llama3"
        else:
            title_model = "gpt-4o-mini"
        
        # Create prompt to generate a short title
        title_prompt = f"""Based on this conversation, generate a concise, descriptive title in the same language as the conversation. Keep it under 8 words and make it clear and specific.

User: {user_message.content}
Assistant: {agent_message.content}

Title (concise, under 8 words):"""
        
        title_messages = [
            {"role": "user", "content": title_prompt}
        ]
        
        title_settings = {
            "temperature": 0.3,
            "top_p": 0.9,
            "openai_api_key": None,
            "gemini_api_key": None,
        }
        
        response = await call_llm(
            user_id=user_id,
            model=title_model,
            messages=title_messages,
            settings=title_settings,
        )
        
        generated_title = (
            response.choices[0].message["content"]
            if hasattr(response, "choices")
            else response["choices"][0]["message"]["content"]
        ).strip()
        
        # Clean up the title (remove quotes, limit length)
        generated_title = generated_title.strip('"\'')
        # Limit to 60 characters to allow for longer titles
        if len(generated_title) > 60:
            generated_title = generated_title[:57] + "..."
        
        # Update dialog title
        dialog.title = generated_title
        db.commit()
        db.refresh(dialog)
        
    except Exception as e:
        # If title generation fails, use a fallback based on user message
        fallback_title = user_message.content[:30].strip()
        if len(fallback_title) < len(user_message.content):
            fallback_title += "..."
        dialog.title = fallback_title
        db.commit()
        db.refresh(dialog)
    
    # Get conversation for config
    conversation = db.query(Conversation).filter(Conversation.id == dialog.conversation_id).first()
    
    sources = db.query(DialogSource).filter(DialogSource.dialog_id == dialog.id).all()
    message_count = db.query(func.count(Message.id)).filter(Message.dialog_id == dialog.id).scalar()
    
    return DialogResponse(
        id=dialog.id,
        title=dialog.title,
        is_pinned=dialog.is_pinned or 0,
        llm_model=conversation.llm_model,  # Get from conversation
        freedom=conversation.freedom,
        temperature=conversation.temperature,
        top_p=conversation.top_p,
        presence_penalty=conversation.presence_penalty,
        frequency_penalty=conversation.frequency_penalty,
        max_tokens=conversation.max_tokens,
        created_at=dialog.created_at,
        updated_at=dialog.updated_at,
        message_count=message_count,
        sources=[DialogSourceResponse(
            id=s.id,
            file_name=s.file_name,
            source_type=s.source_type.value,
            source_value=s.source_value
        ) for s in sources]
    )

