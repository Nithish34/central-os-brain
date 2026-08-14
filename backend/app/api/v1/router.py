from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    documents,
    events,
    conflicts,
    agents,
    intelligence,
    pipeline,
    workflows,
    audit,
    data_foundation,
    demo,
    chat,
)
from app.auth.router import router as auth_router
from app.integrations.router import router as integrations_router
from app.ingestion.router import router as ingestion_router

api_router = APIRouter()

# Layer 5: Authentication, RBAC, Integrations
api_router.include_router(auth_router)
api_router.include_router(integrations_router)

# Layer 4: Ingestion Connectors & Webhooks
api_router.include_router(ingestion_router)

# Layer 3: Pipeline & Events
api_router.include_router(pipeline.router, prefix="/pipeline", tags=["Layer 3 — Processing Pipeline"])
api_router.include_router(events.router, prefix="/events", tags=["Layer 3 — Events"])

# Layer 2: Intelligence Core, Conflicts & Multi-Agents
api_router.include_router(conflicts.router, prefix="/conflicts", tags=["Layer 2 — Conflicts"])
api_router.include_router(agents.router, prefix="/agents", tags=["Layer 2 — Multi-Agent System"])
api_router.include_router(intelligence.router, prefix="/intelligence", tags=["Layer 2 — Intelligence Core"])

# Layer 1: Data Foundation & Documents
api_router.include_router(documents.router, prefix="/documents", tags=["Layer 1 — Documents"])
api_router.include_router(data_foundation.router, prefix="/data-foundation", tags=["Layer 1 — Data Foundation"])

# Layer 0: Execution Engine & Workflows
api_router.include_router(workflows.router, prefix="/workflows", tags=["Layer 0 — Execution"])

# Cross-Cutting: Audit, Health & AI Chat
api_router.include_router(audit.router, prefix="/audit-logs", tags=["Cross-Cutting — Audit Logs"])
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(demo.router, prefix="/demo", tags=["Demo Management"])
api_router.include_router(chat.router, prefix="/chat", tags=["AI Assistant"])
