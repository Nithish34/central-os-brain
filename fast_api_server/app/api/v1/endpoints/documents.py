from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.document import Document
from app.auth.dependencies import get_current_user, get_tenant_repo
from app.services.tenant_repository import TenantScopedRepository
from app.services.layer1_data.db_service import DataService
from app.schemas.document import DocumentsListResponse, DocumentResponse

router = APIRouter()


@router.get("", response_model=DocumentsListResponse, summary="List all official documents for organization")
def get_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs = DataService.get_documents(db, organization_id=current_user.organization_id)
    return {"documents": docs}


@router.get("/sources", summary="List all distinct enterprise data sources for organization")
def get_sources(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs = DataService.get_documents(db, organization_id=current_user.organization_id)
    events = DataService.get_events(db, organization_id=current_user.organization_id)
    sources = sorted({item.source for item in docs + events})
    return {"sources": sources}


@router.get("/{doc_id}", response_model=DocumentResponse, summary="Get single document by ID within organization")
def get_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = DataService.get_document_by_id(db, doc_id, organization_id=current_user.organization_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc
