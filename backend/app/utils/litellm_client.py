from typing import Optional, List, Dict
from app.models import LLMProvider, ProviderEnum
from app.database import SessionLocal
from app.config import settings
import litellm
import json
import os
from pathlib import Path


# Load model cards from external JSON file for easier maintenance
_BASE_DIR = Path(__file__).resolve().parent.parent  # app/
_MODEL_CARDS_PATH = _BASE_DIR / "config" / "model_cards.json"

with _MODEL_CARDS_PATH.open("r", encoding="utf-8") as f:
    MODEL_CARDS: Dict[str, List[Dict]] = json.load(f)

async def get_llm_config(user_id: int, provider: str) -> Optional[Dict]:
    db = SessionLocal()
    try:
        provider_obj = db.query(LLMProvider).filter(
            LLMProvider.user_id == user_id,
            LLMProvider.provider == ProviderEnum(provider)
        ).first()
        
        if provider_obj:
            return {
                "api_key": provider_obj.api_key,
                "base_url": provider_obj.base_url
            }
        return None
    finally:
        db.close()

async def call_llm(
    user_id: int,
    model: str,
    messages: List[Dict],
    settings: Dict
):
    try:
        # Determine provider from model
        provider = "openai"
        api_key = None
        base_url = None
        
        # Check if model name contains "gemini" (case-insensitive)
        model_lower = model.lower()
        if "gemini" in model_lower or model.startswith("google"):
            provider = "gemini"
            config = await get_llm_config(user_id, "gemini")
            if config and config.get("api_key"):
                api_key = config["api_key"]
            else:
                api_key = settings.get("gemini_api_key")
            # Add prefix "gemini/" to model name to use Gemini API (not Vertex AI)
            if not model.startswith("gemini/"):
                model = f"gemini/{model}"
        elif model.startswith("ollama") or model.startswith("llama") or model.startswith("mistral") or model.startswith("codellama") or model.startswith("phi"):
            provider = "ollama"
            config = await get_llm_config(user_id, "ollama")
            if config and config.get("base_url"):
                base_url = config["base_url"]
            else:
                base_url = settings.get("ollama_base_url", "http://localhost:11434")
        else:
            # OpenAI or other
            config = await get_llm_config(user_id, "openai")
            if config and config.get("api_key"):
                api_key = config["api_key"]
            else:
                api_key = settings.get("openai_api_key")
        
        # Build completion parameters
        completion_params = {
            "model": model,
            "messages": messages,
            "temperature": settings.get("temperature", 0.7),
            "top_p": settings.get("top_p", 0.9),
            "max_tokens": settings.get("max_tokens", 2000)
        }
        
        # Pass api_key directly to completion call (no need to set env)
        if provider == "gemini":
            if not api_key:
                raise ValueError(f"Gemini API key not found for user {user_id}. Please configure Gemini provider in settings.")
            completion_params["api_key"] = api_key
        elif provider == "openai":
            if not api_key:
                raise ValueError(f"OpenAI API key not found for user {user_id}. Please configure OpenAI provider in settings.")
            completion_params["api_key"] = api_key
            if base_url:
                completion_params["base_url"] = base_url
        elif provider == "ollama":
            if not base_url:
                raise ValueError(f"Ollama base_url not found for user {user_id}. Please configure Ollama provider in settings.")
            completion_params["base_url"] = base_url
        
        # Gemini API doesn't support presence_penalty and frequency_penalty
        # Only add these parameters for non-Gemini models
        if provider != "gemini":
            completion_params["presence_penalty"] = settings.get("presence_penalty", 0.0)
            completion_params["frequency_penalty"] = settings.get("frequency_penalty", 0.0)
        
        response = litellm.completion(**completion_params)
        
        return response
    except Exception as e:
        print(f"LLM call error: {e}")
        raise

