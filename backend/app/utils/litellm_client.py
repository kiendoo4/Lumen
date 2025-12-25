from typing import Optional, List, Dict
from app.models import LLMProvider, ProviderEnum
from app.database import SessionLocal
from app.config import settings
import litellm

MODEL_CARDS = {
    "openai": [
        {"id": "gpt-4", "name": "GPT-4", "description": "Most capable model, best for complex tasks"},
        {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "description": "Faster and cheaper than GPT-4"},
        {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "description": "Fast and cost-effective"},
        {"id": "gpt-4o", "name": "GPT-4o", "description": "Optimized GPT-4 variant"}
    ],
    "gemini": [
        {"id": "gemini-pro", "name": "Gemini Pro", "description": "Google's advanced model"},
        {"id": "gemini-pro-vision", "name": "Gemini Pro Vision", "description": "Multimodal with vision"},
        {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "description": "Latest Gemini model"},
        {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "description": "Faster Gemini variant"}
    ],
    "ollama": [
        {"id": "llama2", "name": "Llama 2", "description": "Meta's open-source model"},
        {"id": "llama3", "name": "Llama 3", "description": "Latest Llama model"},
        {"id": "mistral", "name": "Mistral", "description": "High-performance open model"},
        {"id": "codellama", "name": "Code Llama", "description": "Specialized for code"},
        {"id": "phi", "name": "Phi", "description": "Microsoft's efficient model"}
    ]
}

async def get_llm_config(user_id: int, provider: str) -> Optional[Dict]:
    db = SessionLocal()
    try:
        provider_obj = db.query(LLMProvider).filter(
            LLMProvider.user_id == user_id,
            LLMProvider.provider == provider
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
        api_key = settings.get("openai_api_key")
        base_url = None
        
        if model.startswith("gemini") or model.startswith("google"):
            provider = "gemini"
            config = await get_llm_config(user_id, "gemini")
            if config:
                api_key = config["api_key"]
            else:
                api_key = settings.get("gemini_api_key")
        elif model.startswith("ollama") or model.startswith("llama") or model.startswith("mistral") or model.startswith("codellama") or model.startswith("phi"):
            provider = "ollama"
            config = await get_llm_config(user_id, "ollama")
            if config:
                base_url = config["base_url"]
            else:
                base_url = settings.get("ollama_base_url", "http://localhost:11434")
        else:
            # OpenAI or other
            config = await get_llm_config(user_id, "openai")
            if config:
                api_key = config["api_key"]
            else:
                api_key = settings.get("openai_api_key")
        
        # Configure litellm
        if api_key:
            import os
            os.environ["OPENAI_API_KEY"] = api_key
        if base_url:
            os.environ["OPENAI_API_BASE"] = base_url
        
        response = litellm.completion(
            model=model,
            messages=messages,
            temperature=settings.get("temperature", 0.7),
            top_p=settings.get("top_p", 0.9),
            presence_penalty=settings.get("presence_penalty", 0.0),
            frequency_penalty=settings.get("frequency_penalty", 0.0),
            max_tokens=settings.get("max_tokens", 2000)
        )
        
        return response
    except Exception as e:
        print(f"LLM call error: {e}")
        raise

