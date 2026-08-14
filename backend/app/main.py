from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.core.config import settings, ROOT_DIR
from app.core.database import init_db, SessionLocal
from app.api.v1.router import api_router
from app.api.v1.endpoints.demo import reset_and_seed_db

FRONTEND_DIR = ROOT_DIR / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schemas on startup
    init_db()
    
    # Auto-seed if database is empty
    db = SessionLocal()
    try:
        from app.models.document import Document
        if db.query(Document).count() == 0:
            reset_and_seed_db(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Self-healing enterprise knowledge and agentic workflow platform prototype",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API V1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Compatibility mount for root /api/... endpoints
app.include_router(api_router, prefix="/api")


# Frontend static files and SPA route
@app.get("/")
def serve_index():
    return FileResponse(FRONTEND_DIR / "index.html")


app.mount("/", StaticFiles(directory=str(FRONTEND_DIR)), name="frontend")
