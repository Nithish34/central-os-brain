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

STATIC_DIR = (ROOT_DIR / "frontend" / "dist") if (ROOT_DIR / "frontend" / "dist").exists() else (ROOT_DIR / "frontend")


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

from app.ingestion.router import router as root_ingestion_router
app.include_router(root_ingestion_router, prefix="")



# Frontend static files and SPA route
if (STATIC_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")


@app.get("/")
def serve_index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": f"{settings.APP_NAME} API is running. Frontend static build not found."}


if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static_root")


@app.exception_handler(404)
async def spa_fallback_404_handler(request, exc):
    path = request.url.path
    # If it's an API, docs, or explicit static asset request, return JSON 404
    if path.startswith(("/api", "/docs", "/redoc", "/openapi.json")) or "." in path.split("/")[-1]:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=404, content={"detail": f"Route '{path}' not found."})
    
    # Otherwise fallback to index.html for React Router SPA navigation
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=404, content={"detail": f"Route '{path}' not found."})

