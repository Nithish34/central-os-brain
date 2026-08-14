from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.layer1_data.db_service import DataService
from app.schemas.document import DocumentsListResponse, DocumentResponse

router = APIRouter()


@router.get("", response_model=DocumentsListResponse, summary="List all official documents")
def get_documents(db: Session = Depends(get_db)):
    docs = DataService.get_documents(db)
    return {"documents": docs}


@router.get("/sources", summary="List all distinct enterprise data sources")
def get_sources(db: Session = Depends(get_db)):
    docs = DataService.get_documents(db)
    events = DataService.get_events(db)
    sources = sorted({item.source for item in docs + events})
    return {"sources": sources}


@router.get("/{doc_id}", response_model=DocumentResponse, summary="Get single document by ID")
def get_document(doc_id: str, db: Session = Depends(get_db)):
    doc = DataService.get_document_by_id(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc
