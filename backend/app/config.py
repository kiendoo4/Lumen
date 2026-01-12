from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    db_host: str = "localhost"
    db_port: int = 3306
    db_user: str = "research_user"
    db_password: str = "research_password"
    db_name: str = "research_agent"
    
    # MinIO
    minio_endpoint: str = "localhost"
    minio_port: int = 9000
    minio_use_ssl: bool = False
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin123"
    minio_bucket: str = "research-agent-files"
    
    # JWT
    jwt_secret: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7
    
    # Default LLM API Keys
    openai_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    ollama_base_url: str = "http://localhost:11434"
    
    # Qdrant Vector Database
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_grpc_port: int = 6334
    qdrant_api_key: Optional[str] = None
    
    # Embedding Model
    embedding_model: str = "intfloat/multilingual-e5-large-instruct"
    chunk_size: int = 1000
    chunk_overlap: int = 200
    
    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()



