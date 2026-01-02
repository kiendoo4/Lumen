from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import LLMProvider, ProviderEnum
from app.schemas import LLMProviderConfig, LLMProviderResponse
from app.middleware.auth import get_current_user
import litellm

router = APIRouter()

@router.get("/", response_model=list[LLMProviderResponse])
async def get_providers(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    providers = db.query(LLMProvider).filter(
        LLMProvider.user_id == current_user["userId"]
    ).all()
    
    return [LLMProviderResponse(
        provider=p.provider.value,
        api_key=p.api_key,
        base_url=p.base_url
    ) for p in providers]

@router.put("/{provider}")
async def update_provider(
    provider: str,
    config: LLMProviderConfig,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if provider not in ["openai", "gemini", "ollama"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid provider"
        )
    
    provider_enum = ProviderEnum(provider)

    # Validate configuration before saving
    if provider_enum == ProviderEnum.openai:
        # Require API key for OpenAI
        if not config.api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="API key is required for this provider"
            )
        # Simple validation: try a tiny completion call
        test_model = (
            "gpt-4o-mini" if provider_enum == ProviderEnum.openai else "gemini-2.5-flash"
        )
        try:
            litellm.completion(
                model=test_model,
                messages=[{"role": "user", "content": "ping"}],
                api_key=config.api_key,
                base_url=config.base_url,
                max_tokens=1,
            )
        except Exception as e:  # pragma: no cover - network/provider specific
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid OpenAI API key or configuration",
            ) from e
    elif provider_enum == ProviderEnum.gemini:
        # Require API key for Gemini
        if not config.api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="API key is required for this provider"
            )
        test_model = "gemini/gemini-2.5-flash"
        try:
            response = litellm.completion(
                model=test_model,
                messages=[{"role": "user", "content": "test"}],
                api_key=config.api_key,
                max_tokens=100,  # Increased to ensure we get content, but validation mainly checks for auth errors
            )
            # If we get here without exception, the API key is valid
            # We don't need to check content since litellm handles auth errors via exceptions
        except Exception as e:  # pragma: no cover - network/provider specific
            # Check if it's an authentication/authorization error
            error_str = str(e).lower()
            if any(keyword in error_str for keyword in ["api key", "authentication", "unauthorized", "invalid", "permission", "403", "401"]):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid Gemini API key or configuration: {str(e)}",
                ) from e
            # For other errors (network, rate limit, etc.), still consider it a config issue
            # but with a more generic message
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Gemini API configuration error: {str(e)}",
            ) from e
    elif provider_enum == ProviderEnum.ollama:
        # For Ollama we validate that base_url + default model is callable
        if not config.base_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Base URL is required for Ollama",
            )
        # Use a common default model name; user can change later via dialog settings
        test_model = "llama3"
        try:
            litellm.completion(
                model=test_model,
                messages=[{"role": "user", "content": "ping"}],
                base_url=config.base_url,
                max_tokens=1,
            )
        except Exception as e:  # pragma: no cover - network/provider specific
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot reach Ollama or default model is not available",
            ) from e
    existing = db.query(LLMProvider).filter(
        LLMProvider.user_id == current_user["userId"],
        LLMProvider.provider == provider_enum
    ).first()
    
    if existing:
        existing.api_key = config.api_key
        existing.base_url = config.base_url
    else:
        new_provider = LLMProvider(
            user_id=current_user["userId"],
            provider=provider_enum,
            api_key=config.api_key,
            base_url=config.base_url
        )
        db.add(new_provider)
    
    db.commit()
    return {"message": "Provider configuration updated"}


