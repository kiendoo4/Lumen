from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import List, Optional, Dict, Any
import json

from app.middleware.auth import get_current_user
from app.database import get_db
from app.models import LLMProvider, ProviderEnum, Dialog, Conversation, Message, RoleEnum
from app.utils.litellm_client import call_llm
from sqlalchemy.orm import Session

router = APIRouter()


def _choose_default_model(db, user_id: int) -> str:
    """
    Pick a default chat model based on configured providers for the user.

    Priority:
      1. OpenAI (gpt-4o-mini)
      2. Gemini (gemini-2.5-flash)
      3. Ollama (llama3)
      4. Fallback: gpt-4o-mini (env-based)
    """
    # Check which providers user has configured
    providers = (
        db.query(LLMProvider)
        .filter(LLMProvider.user_id == user_id)
        .all()
    )
    provider_set = {p.provider for p in providers}

    if ProviderEnum.openai in provider_set:
        return "gpt-4o-mini"
    if ProviderEnum.gemini in provider_set:
        return "gemini-2.5-flash"
    if ProviderEnum.ollama in provider_set:
        return "llama3"

    # Fallback – will rely on env OPENAI_API_KEY
    return "gpt-4o-mini"


@router.post("")
async def chat(
    message: str = Form(...),
    dialog_id: Optional[int] = Form(None),
    context: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Simple QA chat endpoint using LiteLLM.

    - Uses per-user LLM provider configuration (OpenAI/Gemini/Ollama)
    - Basic QA-style system prompt for research assistant use case
    - Includes chat history if dialog_id is provided
    """
    user_id = current_user["userId"]

    # If dialog_id is provided, verify ownership and get dialog settings
    dialog = None
    model = None
    generation_settings = {
        "temperature": 0.7,
        "top_p": 0.9,
        "presence_penalty": 0.0,
        "frequency_penalty": 0.0,
        "max_tokens": 4000,
        "openai_api_key": None,
        "gemini_api_key": None,
    }

    if dialog_id:
        # Verify ownership - join Dialog with Conversation through foreign key
        dialog = db.query(Dialog).join(
            Conversation, Dialog.conversation_id == Conversation.id
        ).filter(
            Dialog.id == dialog_id,
            Conversation.user_id == user_id
        ).first()
        
        if not dialog:
            raise HTTPException(
                status_code=404,
                detail="Dialog not found"
            )
        
        # Get conversation for config (config belongs to conversation, not dialog)
        conversation = db.query(Conversation).filter(Conversation.id == dialog.conversation_id).first()
        
        # Use conversation's model and settings
        model = conversation.llm_model
        generation_settings = {
            "temperature": float(conversation.temperature),
            "top_p": float(conversation.top_p),
            "presence_penalty": float(conversation.presence_penalty),
            "frequency_penalty": float(conversation.frequency_penalty),
            "max_tokens": conversation.max_tokens,
            "openai_api_key": None,
            "gemini_api_key": None,
        }
    else:
        # Choose a default model based on provider config
        model = _choose_default_model(db, user_id)

    # Build basic QA system prompt
    system_prompt = (
        "You are a helpful research assistant. "
        "Answer the user's question clearly and concisely. "
        "If you are not sure, say you are not sure."
    )

    # Optionally include a short description of context in the prompt
    context_snippet = ""
    if context:
        try:
            parsed = json.loads(context)
            # Very light summarization: mention number of papers attached
            papers = parsed.get("papers") or []
            if isinstance(papers, list) and len(papers) > 0:
                context_snippet = (
                    f"User has attached {len(papers)} context items (papers/files). "
                    "Use them conceptually if relevant, but you cannot read their full contents here. "
                )
        except Exception:
            # Ignore invalid context JSON
            pass

    # Build messages array with chat history if dialog_id is provided
    messages = [{"role": "system", "content": system_prompt}]
    
    # Add chat history if dialog exists
    if dialog_id and dialog:
        # Get all messages for this dialog, ordered by creation time
        chat_messages = db.query(Message).filter(
            Message.dialog_id == dialog_id
        ).order_by(Message.created_at.asc()).all()
        
        # Add historical messages to the context
        for msg in chat_messages:
            messages.append({
                "role": msg.role.value,
                "content": msg.content or ""
            })
    
    # Add current user message
    messages.append({
        "role": "user",
        "content": f"{context_snippet}Question: {message}" if context_snippet else message,
    })

    try:
        response = await call_llm(
            user_id=user_id,
            model=model,
            messages=messages,
            settings=generation_settings,
        )

        # LiteLLM completion return format is OpenAI-compatible
        content = (
            response.choices[0].message["content"]
            if hasattr(response, "choices")
            else response["choices"][0]["message"]["content"]
        )

        return {
            "message": content,
            "reasoning": None,
            "confidence": None,
            "sources": [],
        }
    except ValueError as e:
        # API key configuration errors
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )
    except Exception as e:  # pragma: no cover - provider/network specific
        error_msg = str(e)
        # Check if it's an API key error
        if "api_key" in error_msg.lower() or "api key" in error_msg.lower():
            raise HTTPException(
                status_code=400,
                detail=f"API key configuration error: {error_msg}",
            )
        raise HTTPException(
            status_code=500,
            detail=f"LLM call failed: {error_msg}",
        )



