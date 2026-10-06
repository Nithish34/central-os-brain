import pytest
import hmac
import hashlib
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone

from app.core.config import settings
from app.core.redis import redis_client
from app.models.github_connection import GitHubConnection
from app.models.event import CompanyEvent
from app.models.document import Document
from app.models.conflict import Conflict
from app.models.integration import IntegrationAccount, IntegrationStatusEnum
from app.models.workflow import WorkflowAction
from app.services.github_service import (
    GitHubOAuthService,
    GitHubRepoIngestionService,
    GitHubWebhookService,
    GitHubRemediationService,
    GITHUB_SCOPES,
    _load_disk_states,
)
from app.services.layer0_execution.action_executor import ActionExecutorService


def test_github_token_encryption_roundtrip(db, user_a_employee):
    """Test 1: Token encryption and decryption at rest."""
    conn = GitHubConnection(
        id="ghconn-test-01",
        user_id=user_a_employee.id,
        organization_id=user_a_employee.organization_id,
        github_user_id="gh-123456",
        github_login="acme-corp",
    )
    secret_token = "ghp_super_secret_github_access_token_998877"
    conn.set_token(secret_token)

    assert conn.access_token != secret_token
    assert "v1:" in conn.access_token

    db.add(conn)
    db.commit()
    db.refresh(conn)

    decrypted = conn.get_token()
    assert decrypted == secret_token


def test_github_oauth_connect_endpoint(client_a_employee):
    """Test 2: GET /api/github/connect endpoint returns valid authorization URL with exact scopes."""
    resp = client_a_employee.get("/api/github/connect", headers={"Accept": "application/json"})
    assert resp.status_code == 200
    data = resp.json()
    assert "authorization_url" in data
    assert "state" in data

    auth_url = data["authorization_url"]
    assert "https://github.com/login/oauth/authorize" in auth_url
    # User Requirement 1: GITHUB_SCOPES = ["repo", "read:org", "user:email"]
    for scope in GITHUB_SCOPES:
        assert scope in auth_url
    assert "repo" in auth_url
    assert "read:org" in auth_url
    assert "user:email" in auth_url


def test_github_oauth_dual_layer_state_storage(user_a_employee):
    """Test 3: Dual-layer OAuth state persistence (Redis + disk cache with 15-minute TTL)."""
    state = GitHubOAuthService.generate_state(user_a_employee.id, "http://testserver/api/github/callback")
    assert state.startswith("github_state_")

    # 1. Check Redis
    redis_val = redis_client.get(f"github:oauth_state:{state}")
    assert redis_val is not None

    # 2. Check Disk Cache (.cache/oauth_states.json)
    disk_states = _load_disk_states()
    assert state in disk_states
    assert disk_states[state]["user_id"] == user_a_employee.id

    # 3. Retrieve payload via service
    payload = GitHubOAuthService.get_state_payload(state)
    assert payload is not None
    assert payload["user_id"] == user_a_employee.id


def test_github_oauth_callback_flow_and_upsert(client_a_employee, user_a_employee, db):
    """Test 4: GET /api/github/callback exchanges code, stores encrypted token, upserts connection and IntegrationAccount."""
    auth_data = GitHubOAuthService.get_authorization_url(user_a_employee.id, "http://testserver/api/github/callback")
    state = auth_data["state"]

    resp = client_a_employee.get(f"/api/github/callback?code=mock_code_alpha&state={state}")
    assert resp.status_code == 200
    result = resp.json()
    assert result["status"] == "connected"
    assert "github_login" in result

    # Verify GitHubConnection record in DB
    conn = db.query(GitHubConnection).filter(
        GitHubConnection.user_id == user_a_employee.id,
        GitHubConnection.is_active == True,
    ).first()
    assert conn is not None
    assert conn.get_token().startswith("gho_mock_access_token_")
    assert conn.github_login == "acme-engineering"

    # Verify IntegrationAccount record in DB
    int_acc = db.query(IntegrationAccount).filter(
        IntegrationAccount.organization_id == user_a_employee.organization_id,
        IntegrationAccount.provider == "github",
    ).first()
    assert int_acc is not None
    assert int_acc.status == IntegrationStatusEnum.CONNECTED.value


def test_github_single_active_connection_enforcement(client_a_employee, user_a_employee, db):
    """Test 5: Enforce single active GitHub connection per user."""
    # First connection
    state1 = GitHubOAuthService.generate_state(user_a_employee.id)
    resp1 = client_a_employee.get(f"/api/github/callback?code=mock_first&state={state1}")
    assert resp1.status_code == 200

    # Second connection with different profile mock
    state2 = GitHubOAuthService.generate_state(user_a_employee.id)
    with patch.object(GitHubOAuthService, "fetch_user_profile", return_value={"id": 8888, "login": "second-team"}):
        resp2 = client_a_employee.get(f"/api/github/callback?code=mock_second&state={state2}")
        assert resp2.status_code == 200

    active_conns = db.query(GitHubConnection).filter(
        GitHubConnection.user_id == user_a_employee.id,
        GitHubConnection.is_active == True,
    ).all()
    assert len(active_conns) == 1
    assert active_conns[0].github_login == "second-team"


def test_github_status_and_disconnect_endpoints(client_a_employee, user_a_employee, db):
    """Test 6: GET /api/github/status and DELETE /api/github/disconnect."""
    # Ensure active connection exists first
    state = GitHubOAuthService.generate_state(user_a_employee.id)
    client_a_employee.get(f"/api/github/callback?code=mock_for_status&state={state}")

    # Check status when active
    status_resp = client_a_employee.get("/api/github/status")
    assert status_resp.status_code == 200
    data = status_resp.json()
    assert data["is_connected"] is True
    assert data["repo_count"] >= 1

    # Disconnect
    disc_resp = client_a_employee.delete("/api/github/disconnect")
    assert disc_resp.status_code == 200
    assert disc_resp.json()["status"] == "disconnected"

    # Status after disconnect
    status_after = client_a_employee.get("/api/github/status")
    assert status_after.status_code == 200
    assert status_after.json()["is_connected"] is False


def test_github_webhook_hmac_and_dedup(unauth_client, db, org_a):
    """Test 7: Webhook signature verification and Redis fast-path dedup (7-day TTL)."""
    secret = settings.GITHUB_WEBHOOK_SECRET or "github_demo_secret_2026"
    delivery_id = "gh_delivery_unique_9988"
    body_bytes = b'{"action": "ping", "repository": {"full_name": "acme/test-repo"}}'

    # Compute HMAC
    sig = "sha256=" + hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

    headers = {
        "x-hub-signature-256": sig,
        "x-github-delivery": delivery_id,
        "x-github-event": "ping",
        "x-organization-id": org_a.id,
        "content-type": "application/json",
    }

    # 1. First delivery -> processed
    resp1 = unauth_client.post("/api/github/webhook", content=body_bytes, headers=headers)
    assert resp1.status_code == 200
    res1 = resp1.json()
    assert res1["status"] in ["ingested", "processed"]

    # 2. Duplicate delivery -> Redis fast-path dedup triggers
    resp2 = unauth_client.post("/api/github/webhook", content=body_bytes, headers=headers)
    assert resp2.status_code == 200
    res2 = resp2.json()
    assert res2["status"] == "duplicate_ignored"

    # 3. Bad signature -> 401 Unauthorized
    bad_headers = dict(headers)
    bad_headers["x-hub-signature-256"] = "sha256=invalidhexsignature"
    bad_resp = unauth_client.post("/api/github/webhook", content=body_bytes, headers=bad_headers)
    assert bad_resp.status_code == 401


def test_github_webhook_push_and_pr_ingestion(unauth_client, db, org_a):
    """Test 8: Push & PR webhook events normalize into CompanyEvent with repository lineage."""
    secret = settings.GITHUB_WEBHOOK_SECRET or "github_demo_secret_2026"
    delivery_id = "gh_push_del_102938"

    payload_json = {
        "ref": "refs/heads/main",
        "repository": {"full_name": "acme-corp/payment-service"},
        "sender": {"login": "sarah-engineer"},
        "commits": [
            {
                "id": "commit_sha_12345",
                "message": "docs: update API authentication guide",
                "modified": ["docs/architecture/ADR-004-oauth-migration.md"],
                "added": [],
            }
        ],
    }
    raw_body = str(payload_json).replace("'", '"').encode("utf-8")
    sig = "sha256=" + hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

    headers = {
        "x-hub-signature-256": sig,
        "x-github-delivery": delivery_id,
        "x-github-event": "push",
        "x-organization-id": org_a.id,
        "content-type": "application/json",
    }

    resp = unauth_client.post("/api/github/webhook", content=raw_body, headers=headers)
    assert resp.status_code == 200

    # Verify CompanyEvent created with repository lineage in metadata_json
    evt = db.query(CompanyEvent).filter(
        CompanyEvent.organization_id == org_a.id,
        CompanyEvent.provider_event_id == delivery_id,
    ).first()
    assert evt is not None
    assert evt.source == "GitHub"
    assert evt.authority_score == 0.95
    assert evt.metadata_json.get("repository") == "acme-corp/payment-service"
    assert evt.metadata_json.get("file_path") == "docs/architecture/ADR-004-oauth-migration.md"


@pytest.mark.anyio
async def test_github_tree_scanner_and_dynamic_branch(db, org_a):
    """Test 9: Git Trees scanner resolves default_branch dynamically and ingests documents into CompanyEvent."""
    # User Requirement 2: Dynamically resolve default_branch
    default_branch = await GitHubRepoIngestionService.get_default_branch("acme-corp", "payment-service", "gho_mock_token")
    assert default_branch == "main"

    res = await GitHubRepoIngestionService.scan_and_sync_repository(
        owner="acme-corp",
        repo="payment-service",
        access_token="gho_mock_token",
        organization_id=org_a.id,
        db=db,
    )
    assert res["repository"] == "acme-corp/payment-service"
    assert res["events_ingested"] >= 2

    # Check CompanyEvent documents have repository lineage in metadata_json
    events = db.query(CompanyEvent).filter(
        CompanyEvent.organization_id == org_a.id,
        CompanyEvent.source == "GitHub",
    ).all()
    assert len(events) >= 2
    for ev in events:
        if ev.ingestion_source == "github-tree-scanner":
            assert ev.metadata_json.get("repository") == "acme-corp/payment-service"
            assert ev.metadata_json.get("file_path") is not None


def test_action_executor_github_remediation_pr(db, org_a):
    """Test 10: ActionExecutorService creates branch axiom/fix-docs-<conflict-id> and opens Pull Request."""
    # 1. Create a documentation event with repository lineage
    doc_evt = CompanyEvent(
        id="evt-gh-test-lineage",
        organization_id=org_a.id,
        provider_event_id="gh_doc_test_101",
        source="GitHub",
        type="documentation.synced",
        title="Payment Service Auth",
        content="Old basic auth credentials required.",
        author="eng-bot",
        owner="Platform Engineering",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
    doc_evt.metadata_json = {
        "repository": "acme-corp/payment-service",
        "file_path": "docs/architecture/ADR-004-oauth-migration.md",
    }
    db.add(doc_evt)

    # Create associated document
    test_doc = Document(
        id="doc-test-auth-01",
        organization_id=org_a.id,
        source="GitHub",
        title="acme-corp/payment-service:docs/architecture/ADR-004-oauth-migration.md",
        content="Old basic auth credentials required.",
        author="eng-bot",
        owner="Platform Engineering",
        timestamp=datetime.now(timezone.utc).isoformat(),
        status="stale",
        freshness_score=0.4,
    )
    db.add(test_doc)

    # 2. Create conflict referencing evidence
    conflict = Conflict(
        id="c-docs-auth-01",
        organization_id=org_a.id,
        title="Conflict in Authentication Architecture",
        owner="Priya Raman",
        domain="Engineering",
        document_id=test_doc.id,
        detected_by="ConflictDetectorService",
        status="open",
        old_claim="Basic Auth required",
        new_claim="OAuth2 required",
        recommended_update="All payment gateway endpoints require OAuth2 Bearer tokens.",
        business_impact="Critical security and integration disruption",
        risk_level="HIGH",
    )
    conflict.evidence_ids = [doc_evt.id]
    db.add(conflict)
    db.commit()

    # 3. Execute approval action
    status_code, response_data = ActionExecutorService.apply_approval(
        db=db,
        conflict_id=conflict.id,
        action="approve",
        reason="Approved by Lead Architect",
    )
    assert status_code == 200
    assert "workflows" in response_data

    # 4. Check GitHub workflow action
    gh_wf = None
    for wf in response_data["workflows"]:
        if wf["tool"] == "GitHub":
            gh_wf = wf
            break

    assert gh_wf is not None
    assert "PR opened: axiom/fix-docs-c-docs-auth-01" in gh_wf["title"]
    assert "axiom/fix-docs-c-docs-auth-01" in gh_wf["description"]
    assert "https://github.com/acme-corp/payment-service/pull/" in gh_wf["description"]
