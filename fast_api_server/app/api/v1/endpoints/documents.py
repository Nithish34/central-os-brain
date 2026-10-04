import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.caching import cache_manager, build_cache_key
from app.models.user import User
from app.models.document import Document
from app.auth.dependencies import get_current_user, get_tenant_repo
from app.services.tenant_repository import TenantScopedRepository
from app.services.layer1_data.db_service import DataService
from app.schemas.document import DocumentsListResponse, DocumentResponse

router = APIRouter()


@router.get("", response_model=DocumentsListResponse, summary="List all official documents for organization")
def get_documents(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cache_key = build_cache_key(current_user.organization_id, "documents")
    t0 = time.perf_counter()
    cached = cache_manager.get(cache_key)
    if cached is not None:
        _record_timing(request, "cache", t0)
        return cached

    t_db = time.perf_counter()
    docs = DataService.get_documents(db, organization_id=current_user.organization_id)
    result = {"documents": docs}
    _record_timing(request, "db", t_db)

    cache_manager.set(cache_key, result, ttl=60)
    _record_timing(request, "cache_write", t0)
    return result


@router.get("/sources", summary="List all distinct enterprise data sources for organization")
def get_sources(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cache_key = build_cache_key(current_user.organization_id, "documents", extra="sources")
    t0 = time.perf_counter()
    cached = cache_manager.get(cache_key)
    if cached is not None:
        _record_timing(request, "cache", t0)
        return cached

    t_db = time.perf_counter()
    docs = DataService.get_documents(db, organization_id=current_user.organization_id)
    events = DataService.get_events(db, organization_id=current_user.organization_id)
    sources = sorted({item.source for item in docs + events})
    _record_timing(request, "db", t_db)

    result = {"sources": sources}
    cache_manager.set(cache_key, result, ttl=60)
    return result


@router.get("/{doc_id}", response_model=DocumentResponse, summary="Get single document by ID within organization")
def get_document(
    doc_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cache_key = build_cache_key(current_user.organization_id, "documents", extra=doc_id)
    t0 = time.perf_counter()
    cached = cache_manager.get(cache_key)
    if cached is not None:
        _record_timing(request, "cache", t0)
        return cached

    t_db = time.perf_counter()
    doc = DataService.get_document_by_id(db, doc_id, organization_id=current_user.organization_id)
    _record_timing(request, "db", t_db)

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    cache_manager.set(cache_key, doc, ttl=120)
    return doc


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _record_timing(request: Request, label: str, t_start: float) -> None:
    """Append a Server-Timing metric to the request state for ServerTimingMiddleware."""
    if not hasattr(request.state, "server_timing"):
        request.state.server_timing = {}
    request.state.server_timing[label] = (time.perf_counter() - t_start) * 1000
