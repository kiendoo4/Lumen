from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
import uvicorn

from app.routes import auth, llm_providers, conversations, dialogs, models, files, messages
from app.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    yield
    # Shutdown
    pass

app = FastAPI(title="Research Agent API", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(llm_providers.router, prefix="/api/llm-providers", tags=["llm-providers"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["conversations"])
app.include_router(dialogs.router, prefix="/api/dialogs", tags=["dialogs"])
app.include_router(messages.router, prefix="/api/messages", tags=["messages"])
app.include_router(models.router, prefix="/api/models", tags=["models"])
app.include_router(files.router, prefix="/api/files", tags=["files"])

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3001, reload=True)

