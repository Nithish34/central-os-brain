import pytest
from app.models.document import Document
from app.models.event import CompanyEvent
from app.models.conflict import Conflict
from app.models.agent import AgentProfile
from app.models.audit import AuditLog
from app.models.integration import IntegrationAccount, IntegrationStatusEnum
from app.services.tenant_repository import TenantScopedRepository


def test_documents_cross_tenant_isolation(db, org_a, org_b, client_a_owner, client_b_owner):
    # Seed document strictly in Org A
    repo_a = TenantScopedRepository(db, org_a.id)
    doc_a = Document(
        id="doc-alpha-secret-001",
        organization_id=org_a.id,
        source="Notion",
        type="official_document",
        title="Alpha Confidential Architecture",
        content="Alpha internal secret token design.",
        author="Alice",
        owner="Engineering",
        timestamp="2026-09-21T12:00:00Z",
    )
    repo_a.add(doc_a)
    repo_a.commit()

    # 1. Org A user can read doc
    res_a = client_a_owner.get("/api/v1/documents")
    assert res_a.status_code == 200
    docs_a = res_a.json()["documents"]
    assert any(d["id"] == "doc-alpha-secret-001" for d in docs_a)

    # 2. Org B user querying list gets NO documents from Org A
    res_b = client_b_owner.get("/api/v1/documents")
    assert res_b.status_code == 200
    docs_b = res_b.json()["documents"]
    assert not any(d["id"] == "doc-alpha-secret-001" for d in docs_b)

    # 3. Org B user directly requesting Org A's doc ID gets 404
    res_b_direct = client_b_owner.get("/api/v1/documents/doc-alpha-secret-001")
    assert res_b_direct.status_code == 404


def test_events_cross_tenant_isolation(db, org_a, org_b, client_a_owner, client_b_owner):
    repo_a = TenantScopedRepository(db, org_a.id)
    evt_a = CompanyEvent(
        id="evt-alpha-001",
        organization_id=org_a.id,
        provider_event_id="slack_001",
        source="Slack",
        type="message.created",
        title="Alpha Decision",
        content="Alpha private message",
        author="Alice",
        owner="Engineering",
        timestamp="2026-09-21T12:00:00Z",
    )
    repo_a.add(evt_a)
    repo_a.commit()

    # Org B cannot see Org A event
    res_b = client_b_owner.get("/api/v1/events")
    assert res_b.status_code == 200
    events_b = res_b.json()["events"]
    assert not any(e["id"] == "evt-alpha-001" for e in events_b)

    res_b_direct = client_b_owner.get("/api/v1/events/evt-alpha-001")
    assert res_b_direct.status_code == 404


def test_conflicts_cross_tenant_isolation(db, org_a, org_b, client_a_owner, client_b_owner):
    # Create doc & conflict in Org A
    repo_a = TenantScopedRepository(db, org_a.id)
    doc_a = Document(
        id="doc-conf-a-001",
        organization_id=org_a.id,
        source="Notion",
        title="Doc A",
        content="Doc content",
        author="Alice",
        owner="Engineering",
        timestamp="2026-09-21T12:00:00Z",
    )
    repo_a.add(doc_a)
    repo_a.commit()

    conf_a = Conflict(
        id="conf-alpha-001",
        organization_id=org_a.id,
        title="JWT vs OAuth2 Conflict",
        severity="high",
        domain="security",
        document_id=doc_a.id,
        old_claim="Uses JWT",
        new_claim="Uses OAuth2",
        recommended_update="Update to OAuth2",
        business_impact="High security impact",
        owner="Alice",
        status="open",
    )
    repo_a.add(conf_a)
    repo_a.commit()

    # Org B list cannot see Org A conflict
    res_b = client_b_owner.get("/api/v1/conflicts")
    assert res_b.status_code == 200
    assert not any(c["id"] == "conf-alpha-001" for c in res_b.json()["conflicts"])

    # Org B direct GET returns 404
    res_b_get = client_b_owner.get("/api/v1/conflicts/conf-alpha-001")
    assert res_b_get.status_code == 404

    # Org B cannot approve Org A conflict
    res_b_approve = client_b_owner.post("/api/v1/conflicts/conf-alpha-001/approve", json={"reason": "Hacking attempt"})
    assert res_b_approve.status_code == 404


def test_audit_logs_cross_tenant_isolation(db, org_a, org_b, client_a_owner, client_b_owner):
    repo_a = TenantScopedRepository(db, org_a.id, "usr-a", "Alice")
    repo_a.log_audit("test.action", "Org A Sensitive Action", target="target-a", reason="Confidential")

    res_b = client_b_owner.get("/api/v1/audit-logs")
    assert res_b.status_code == 200
    logs_b = res_b.json()["audit_logs"]
    assert not any(l["title"] == "Org A Sensitive Action" for l in logs_b)


def test_integrations_cross_tenant_isolation(db, org_a, org_b, client_a_owner, client_b_owner):
    # Connect Slack in Org A
    int_a = IntegrationAccount(
        id="int-slack-alpha",
        organization_id=org_a.id,
        provider="slack",
        name="Slack Alpha",
        status=IntegrationStatusEnum.CONNECTED.value,
        account_id="T-ALPHA-999",
        account_name="Alpha Slack",
    )
    db.add(int_a)
    db.commit()

    # Org A sees Slack as connected with account T-ALPHA-999
    res_a = client_a_owner.get("/api/v1/integrations")
    assert res_a.status_code == 200
    slack_a = next(i for i in res_a.json() if i["provider"] == "slack")
    assert slack_a["status"] == "connected"
    assert slack_a["account_id"] == "T-ALPHA-999"

    # Org B sees Slack as disconnected
    res_b = client_b_owner.get("/api/v1/integrations")
    assert res_b.status_code == 200
    slack_b = next(i for i in res_b.json() if i["provider"] == "slack")
    assert slack_b["status"] == "disconnected"
    assert slack_b["account_id"] is None
