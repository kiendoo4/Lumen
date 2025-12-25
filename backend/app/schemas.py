from __future__ import annotations

from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal

# Auth Schemas
class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    avatar_url: Optional[str] = None
    
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    avatar_url: Optional[str] = None

# LLM Provider Schemas
class LLMProviderConfig(BaseModel):
    provider: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None

class LLMProviderResponse(BaseModel):
    provider: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    
    class Config:
        from_attributes = True

# Conversation Schemas
class ConversationCreate(BaseModel):
    title: Optional[str] = "New Conversation"

class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    avatar_url: Optional[str] = None

class ConversationResponse(BaseModel):
    id: int
    title: str
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    dialog_count: Optional[int] = 0
    dialogs: Optional[List['DialogResponse']] = []
    
    class Config:
        from_attributes = True

# Dialog Schemas
class DialogCreate(BaseModel):
    title: Optional[str] = "New Dialog"
    llm_model: Optional[str] = "gpt-4"
    freedom: Optional[float] = 0.5
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9
    presence_penalty: Optional[float] = 0.0
    frequency_penalty: Optional[float] = 0.0
    max_tokens: Optional[int] = 2000

class DialogUpdate(BaseModel):
    title: Optional[str] = None
    llm_model: Optional[str] = None
    freedom: Optional[float] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    presence_penalty: Optional[float] = None
    frequency_penalty: Optional[float] = None
    max_tokens: Optional[int] = None

class DialogResponse(BaseModel):
    id: int
    title: str
    llm_model: str
    freedom: Decimal
    temperature: Decimal
    top_p: Decimal
    presence_penalty: Decimal
    frequency_penalty: Decimal
    max_tokens: int
    created_at: datetime
    updated_at: datetime
    message_count: Optional[int] = 0
    sources: Optional[List['DialogSourceResponse']] = []
    
    class Config:
        from_attributes = True

# Source Schemas
class DialogSourceCreate(BaseModel):
    source_type: Optional[str] = "file"
    source_value: Optional[str] = None

class DialogSourceResponse(BaseModel):
    id: int
    file_name: Optional[str] = None
    source_type: str
    source_value: Optional[str] = None
    
    class Config:
        from_attributes = True

# Model Schemas
class ModelCard(BaseModel):
    id: str
    name: str
    description: str

class ModelCardsResponse(BaseModel):
    openai: List[ModelCard]
    gemini: List[ModelCard]
    ollama: List[ModelCard]

# Message Schemas
class MessageResponse(BaseModel):
    id: int
    role: str
    content: Optional[str] = None
    reasoning: Optional[Dict[str, Any]] = None
    confidence: Optional[str] = None
    sources: Optional[Dict[str, Any]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Rebuild models to resolve forward references
ConversationResponse.model_rebuild()
DialogResponse.model_rebuild()
DialogSourceResponse.model_rebuild()

