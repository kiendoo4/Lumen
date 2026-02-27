from typing import Optional, List, Dict
from app.models import LLMProvider, ProviderEnum
from app.database import SessionLocal
import litellm
import json
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
            if not config or not config.get("api_key"):
                raise ValueError(f"Gemini API key not found for user {user_id}. Please configure Gemini provider in settings.")
            api_key = config["api_key"]
            # Add prefix "gemini/" to model name to use Gemini API (not Vertex AI)
            if not model.startswith("gemini/"):
                model = f"gemini/{model}"
        elif model.startswith("groq/"):
            provider = "groq"
            config = await get_llm_config(user_id, "groq")
            if not config or not config.get("api_key"):
                raise ValueError(f"Groq API key not found for user {user_id}. Please configure Groq provider in settings.")
            api_key = config["api_key"]
        elif model.startswith("ollama") or model.startswith("llama") or model.startswith("mistral") or model.startswith("codellama") or model.startswith("phi"):
            provider = "ollama"
            config = await get_llm_config(user_id, "ollama")
            if not config or not config.get("base_url"):
                raise ValueError(f"Ollama base_url not found for user {user_id}. Please configure Ollama provider in settings.")
            base_url = config["base_url"]
        else:
            # OpenAI or other
            config = await get_llm_config(user_id, "openai")
            if not config or not config.get("api_key"):
                raise ValueError(f"OpenAI API key not found for user {user_id}. Please configure OpenAI provider in settings.")
            api_key = config["api_key"]
        
        # Normalize messages for Gemini (convert "agent" to "assistant" and handle "system")
        normalized_messages = []
        if provider == "gemini":
            for msg in messages:
                role = msg.get("role", "").lower()
                content = msg.get("content", "")
                
                # Skip empty messages
                if not content or not content.strip():
                    continue
                
                # Convert "agent" to "assistant" for Gemini
                if role == "agent":
                    role = "assistant"
                # Gemini doesn't support "system" role, merge into first user message
                elif role == "system":
                    # If we have a user message, prepend system content to it
                    if normalized_messages and normalized_messages[-1].get("role") == "user":
                        normalized_messages[-1]["content"] = f"{content}\n\n{normalized_messages[-1]['content']}"
                    else:
                        # Otherwise, skip system message or convert to user message
                        continue
                
                # Only allow "user" and "assistant" roles for Gemini
                if role in ["user", "assistant"]:
                    normalized_messages.append({
                        "role": role,
                        "content": content
                    })
        else:
            # For other providers, just normalize "agent" to "assistant"
            for msg in messages:
                role = msg.get("role", "").lower()
                content = msg.get("content", "")
                
                if not content or not content.strip():
                    continue
                
                if role == "agent":
                    role = "assistant"
                
                normalized_messages.append({
                    "role": role,
                    "content": content
                })
        
        # Build completion parameters
        completion_params = {
            "model": model,
            "messages": normalized_messages,
            "temperature": settings.get("temperature", 0.7),
            "top_p": settings.get("top_p", 0.9),
            "max_tokens": settings.get("max_tokens", 2000)
        }
        
        # Pass api_key directly to completion call
        if provider == "gemini":
            completion_params["api_key"] = api_key
        elif provider == "openai":
            completion_params["api_key"] = api_key
            if base_url:
                completion_params["base_url"] = base_url
        elif provider == "groq":
            completion_params["api_key"] = api_key
        elif provider == "ollama":
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

