from typing import List
from fastapi import APIRouter, Depends, HTTPException
from app.integrations.schemas import Provider, IntegrationStatus, ConnectRequest
from app.integrations.service import IntegrationService
from app.auth.dependencies import get_current_user
from app.auth.schemas import UserResponse
from app.rbac.dependencies import require_permission

router = APIRouter(prefix="/integrations", tags=["Layer 5 — Integrations & Connectors Catalog"])


@router.get("", response_model=List[IntegrationStatus], summary="List all enterprise connector integrations")
def list_integrations(user: UserResponse = Depends(require_permission("integrations:read"))):
    return IntegrationService.get_all()


@router.get("/{provider}", response_model=IntegrationStatus, summary="Get single integration status by provider")
def get_integration(provider: Provider, user: UserResponse = Depends(require_permission("integrations:read"))):
    item = IntegrationService.get_by_provider(provider)
    if not item:
        raise HTTPException(status_code=404, detail="Integration provider not found")
    return item


@router.post("/{provider}/connect", response_model=IntegrationStatus, summary="Connect or configure an integration provider")
def connect_integration(provider: Provider, request: ConnectRequest, user: UserResponse = Depends(require_permission("integrations:write"))):
    return IntegrationService.connect_provider(provider, request.account_id, request.account_name)


@router.post("/{provider}/sync", response_model=IntegrationStatus, summary="Trigger manual sync on an integration provider")
def sync_integration(provider: Provider, user: UserResponse = Depends(require_permission("integrations:write"))):
    return IntegrationService.sync_provider(provider)
