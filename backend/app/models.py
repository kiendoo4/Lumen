from sqlalchemy import Column, Integer, String, Text, DECIMAL, BigInteger, Enum, ForeignKey, JSON, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class ProviderEnum(str, enum.Enum):
    openai = "openai"
    gemini = "gemini"
    ollama = "ollama"

class RoleEnum(str, enum.Enum):
    user = "user"
    agent = "agent"

class SourceTypeEnum(str, enum.Enum):
    file = "file"
    doi = "doi"
    arxiv = "arxiv"
    url = "url"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    avatar_url = Column(String(500))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    llm_providers = relationship("LLMProvider", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")

class LLMProvider(Base):
    __tablename__ = "llm_providers"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(Enum(ProviderEnum), nullable=False)
    api_key = Column(Text)
    base_url = Column(String(500))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="llm_providers")
    
    __table_args__ = ({"mysql_engine": "InnoDB"},)

class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    avatar_url = Column(String(500))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="conversations")
    dialogs = relationship("Dialog", back_populates="conversation", cascade="all, delete-orphan")

class Dialog(Base):
    __tablename__ = "dialogs"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    llm_model = Column(String(100), default="gpt-4")
    freedom = Column(DECIMAL(3, 2), default=0.50)
    temperature = Column(DECIMAL(3, 2), default=0.70)
    top_p = Column(DECIMAL(3, 2), default=0.90)
    presence_penalty = Column(DECIMAL(3, 2), default=0.00)
    frequency_penalty = Column(DECIMAL(3, 2), default=0.00)
    max_tokens = Column(Integer, default=2000)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    conversation = relationship("Conversation", back_populates="dialogs")
    messages = relationship("Message", back_populates="dialog", cascade="all, delete-orphan")
    sources = relationship("DialogSource", back_populates="dialog", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    dialog_id = Column(Integer, ForeignKey("dialogs.id", ondelete="CASCADE"), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    content = Column(Text)
    reasoning = Column(JSON)
    confidence = Column(String(50))
    sources = Column(JSON)
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    dialog = relationship("Dialog", back_populates="messages")
    files = relationship("MessageFile", back_populates="message", cascade="all, delete-orphan")

class DialogSource(Base):
    __tablename__ = "dialog_sources"
    
    id = Column(Integer, primary_key=True, index=True)
    dialog_id = Column(Integer, ForeignKey("dialogs.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500))
    file_type = Column(String(50))
    file_size = Column(BigInteger)
    source_type = Column(Enum(SourceTypeEnum), default=SourceTypeEnum.file)
    source_value = Column(String(500))
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    dialog = relationship("Dialog", back_populates="sources")

class MessageFile(Base):
    __tablename__ = "message_files"
    
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50))
    file_size = Column(BigInteger)
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    message = relationship("Message", back_populates="files")


