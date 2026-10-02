from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import settings, ROOT_DIR
from app.core.database import init_db, SessionLocal
from app.core.middleware import (
    SecurityHeadersMiddleware,
    CSRFMiddleware,
    RateLimitMiddleware,
)
from app.api.v1.router import api_router
from app.api.v1.endpoints.demo import reset_and_seed_db

STATIC_DIR = (ROOT_DIR / "frontend" / "dist") if (ROOT_DIR / "frontend" / "dist").exists() else (ROOT_DIR / "frontend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schemas on startup if in dev/sqlite
    init_db()
    
    # Auto-seed if database is empty
    db = SessionLocal()
    try:
        from app.models.organization import Organization
        from app.models.user import User, UserRole
        from app.core.security import hash_password

        # Ensure default organization exists
        default_org = db.query(Organization).filter(Organization.slug == "default").first()
        if not default_org:
            default_org = Organization(
                id="org-default",
                name="Acme Corp Demo",
                slug="default",
                domain="companybrain.local",
                plan="enterprise",
            )
            db.add(default_org)
            db.flush()

        # Ensure bootstrap admin exists
        admin = db.query(User).filter(User.email == settings.ADMIN_BOOTSTRAP_EMAIL).first()
        if not admin:
            admin = User(
                id="usr-admin-bootstrap",
                organization_id=default_org.id,
                email=settings.ADMIN_BOOTSTRAP_EMAIL,
                hashed_password=hash_password(settings.ADMIN_BOOTSTRAP_PASSWORD),
                full_name="System Administrator",
                role=UserRole.OWNER.value,
                auth_provider="local",
                is_active=True,
            )
            db.add(admin)

        db.commit()

        from app.models.document import Document
        if db.query(Document).filter(Document.organization_id == default_org.id).count() == 0:
            reset_and_seed_db(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Company Brain OS API",
    description="Company Brain OS — Real Integrated Multi-Tenant Enterprise Intelligence Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Custom Middlewares
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CSRFMiddleware)
app.add_middleware(RateLimitMiddleware)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS if isinstance(settings.CORS_ALLOWED_ORIGINS, list) else ["*"],
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

# Static files and assets
if (STATIC_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

if (STATIC_DIR / "images").exists():
    app.mount("/images", StaticFiles(directory=str(STATIC_DIR / "images")), name="images")
elif (ROOT_DIR / "frontend" / "public" / "images").exists():
    app.mount("/images", StaticFiles(directory=str(ROOT_DIR / "frontend" / "public" / "images")), name="images")

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static_root")


@app.get("/")
def serve_index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": f"{settings.APP_NAME} API is running."}


@app.exception_handler(404)
async def spa_fallback_404_handler(request, exc):
    path = request.url.path
    if path.startswith(("/api", "/docs", "/redoc", "/openapi.json")):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=404, content={"detail": f"API route '{path}' not found."})
    
    rel_path = path.lstrip("/")
    target_file = STATIC_DIR / rel_path
    if target_file.is_file():
        return FileResponse(target_file)

    public_file = (ROOT_DIR / "frontend" / "public") / rel_path
    if public_file.is_file():
        return FileResponse(public_file)
    
    if "." in path.split("/")[-1] and not path.endswith(".html"):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=404, content={"detail": f"Static asset '{path}' not found."})

    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=404, content={"detail": f"Route '{path}' not found."})
