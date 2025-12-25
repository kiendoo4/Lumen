# Research-Oriented Conversational Agent

A chat-based research assistant that supports structured reasoning and specialized tools for scientific document interaction.

## Setup

### Prerequisites
- Docker and Docker Compose
- Python 3.9+
- Node.js 18+

### 1. Start Docker Services

```bash
docker-compose up -d
```

This will start:
- MySQL on port 3306
- MinIO on ports 9000 (API) and 9001 (Console)

### 2. Setup Backend (Python)

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Configure Environment

Create `.env` file in `backend` directory:

```env
DATABASE_URL=mysql+pymysql://user:password@localhost:3306/research_agent_db
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadminpassword
MINIO_BUCKET=research-agent
JWT_SECRET=your-secret-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRE_DAYS=7
```

### 4. Initialize Database

The database schema will be automatically created when you start the backend server for the first time.

### 5. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 6. Start Development Servers

**Backend:**
```bash
cd backend
source venv/bin/activate  # Activate venv if not already activated
python main.py
# Or use uvicorn directly:
uvicorn main:app --reload --port 3001
```

**Frontend:**
```bash
cd frontend
npm run dev
```

Frontend: http://localhost:3000  
Backend: http://localhost:3001  
API Docs: http://localhost:3001/docs  
MinIO Console: http://localhost:9001 (minioadmin/minioadminpassword)

## Architecture

### Backend
- FastAPI (Python) API server
- SQLAlchemy ORM for database operations
- MySQL database for data persistence
- MinIO for file storage
- LiteLLM for LLM integration (OpenAI, Gemini, Ollama)
- JWT authentication with passlib for password hashing

### Frontend
- React with Vite
- Conversation/Dialog management
- File upload for RAG context
- LLM settings per dialog
- Theme support (light/dark)
- i18n (English/Vietnamese)

## Features

- User authentication (register/login)
- Profile management (avatar, password)
- LLM provider configuration (API keys)
- Conversation and Dialog management
- File upload for research context (RAG)
- Advanced LLM parameters per dialog
- Model selection (GPT, Gemini, Ollama)
