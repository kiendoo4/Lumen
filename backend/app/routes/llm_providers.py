from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import LLMProvider, ProviderEnum
from app.schemas import LLMProviderConfig, LLMProviderResponse
from app.middleware.auth import get_current_user

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


