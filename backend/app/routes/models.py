from fastapi import APIRouter
from app.schemas import ModelCardsResponse, ModelCard
from app.utils.litellm_client import MODEL_CARDS

router = APIRouter()

@router.get("/", response_model=ModelCardsResponse)
async def get_models():
    return ModelCardsResponse(
        openai=[ModelCard(**card) for card in MODEL_CARDS["openai"]],
        gemini=[ModelCard(**card) for card in MODEL_CARDS["gemini"]],
        ollama=[ModelCard(**card) for card in MODEL_CARDS["ollama"]]
    )


