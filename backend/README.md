# Research Agent Backend (Python)

FastAPI backend for Research Agent application.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Copy `.env.example` to `.env` and configure

3. Make sure Docker services are running:
```bash
docker-compose up -d
```

4. Run the server:
```bash
uvicorn main:app --reload --port 3001
```

Or:
```bash
python main.py
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:3001/docs
- ReDoc: http://localhost:3001/redoc


