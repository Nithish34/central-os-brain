import time
import json
import hmac
import hashlib
import pytest
from app.core.config import settings
from app.core.security import encryption_manager
from app.models.integration import IntegrationAccount, IntegrationStatusEnum
from app.models.event import CompanyEvent
from app.integrations.connectors.slack import SlackConnector
from app.integrations.connectors.github import GitHubConnector


def test_oauth_authorization_url_and_state(client_a_admin):
    resp = client_a_admin.get("/api/v1/integrations/slack/authorize")
    assert resp.status_code == 200
    data = resp.json()
    assert "authorization_url" in data
    assert "state" in data
    assert "slack.com/oauth/v2/authorize" in data["authorization_url"]


def test_oauth_callback_immediate_response_and_encryption(unauth_client, client_a_admin, db, org_a):
    # 1. Generate valid state
    auth_resp = client_a_admin.get("/api/v1/integrations/slack/authorize")
    state = auth_resp.json()["state"]

    # 2. Callback returns immediately with status="syncing" [REV2]
    cb_resp = unauth_client.get(f"/api/v1/integrations/slack/callback?code=mock_code_123&state={state}")
    assert cb_resp.status_code == 200
    data = cb_resp.json()
    assert data["status"] == "syncing"
    assert data["provider"] == "slack"

    # 3. Verify token was encrypted at rest with versioned prefix in DB
    int_acc = db.query(IntegrationAccount).filter(
        IntegrationAccount.organization_id == org_a.id,
        IntegrationAccount.provider == "slack",
    ).first()
    assert int_acc is not None
    assert int_acc.encrypted_access_token.startswith("v1:")
    decrypted = encryption_manager.decrypt(int_acc.encrypted_access_token)
    assert decrypted == "xoxb-mock-slack-access-token-mock_code_123"


def test_oauth_invalid_state_rejected(unauth_client):
    resp = unauth_client.get("/api/v1/integrations/slack/callback?code=mock_code_123&state=invalid_or_expired_state")
    assert resp.status_code == 400
    assert "Invalid or expired OAuth state" in resp.json()["detail"]


def test_slack_webhook_signature_verification(unauth_client, db, org_a):
    # Setup slack integration for org_a
    connector = SlackConnector()
    connector.connect({"access_token": "xoxb-test"}, org_a.id, db)

    payload = {
        "event_id": "evt_slack_test_001",
        "type": "event_callback",
        "event": {
            "type": "message",
            "text": "Critical payment architecture discussion in #eng-sync",
            "user": "U12345",
            "channel": "C99999",
        }
    }
    body = json.dumps(payload).encode("utf-8")
    now_ts = str(int(time.time()))

    # Compute valid signature
    secret = settings.SLACK_SIGNING_SECRET
    sig_basestring = f"v0:{now_ts}:{body.decode('utf-8')}".encode("utf-8")
    valid_sig = "v0=" + hmac.new(secret.encode("utf-8"), sig_basestring, hashlib.sha256).hexdigest()

    # 1. Invalid signature returns 401
    bad_headers = {
        "x-slack-request-timestamp": now_ts,
        "x-slack-signature": "v0=invalid_signature_hash_12345",
        "Content-Type": "application/json",
    }
    resp_bad = unauth_client.post("/api/v1/integrations/slack/webhook", content=body, headers=bad_headers)
    assert resp_bad.status_code == 401

    # 2. Valid signature returns 200 and ingests event
    good_headers = {
        "x-slack-request-timestamp": now_ts,
        "x-slack-signature": valid_sig,
        "Content-Type": "application/json",
    }
    resp_good = unauth_client.post(f"/api/v1/integrations/slack/webhook?org_id={org_a.id}", content=body, headers=good_headers)
    assert resp_good.status_code == 200
    assert resp_good.json()["status"] == "ingested"


def test_webhook_idempotency(unauth_client, db, org_a):
    """
    Delivering the same webhook payload twice results in exactly ONE event stored [REV2].
    """
    connector = SlackConnector()
    connector.connect({"access_token": "xoxb-test"}, org_a.id, db)

    event_id = "evt_dedup_unique_099"
    payload = {
        "event_id": event_id,
        "type": "event_callback",
        "event": {
            "type": "message",
            "text": "Idempotent deployment confirmation message",
            "user": "U_DEPLOYER",
            "channel": "C_PROD",
        }
    }
    body = json.dumps(payload).encode("utf-8")
    now_ts = str(int(time.time()))

    sig_basestring = f"v0:{now_ts}:{body.decode('utf-8')}".encode("utf-8")
    valid_sig = "v0=" + hmac.new(settings.SLACK_SIGNING_SECRET.encode("utf-8"), sig_basestring, hashlib.sha256).hexdigest()

    headers = {
        "x-slack-request-timestamp": now_ts,
        "x-slack-signature": valid_sig,
        "Content-Type": "application/json",
    }

    # First delivery -> status: ingested
    resp1 = unauth_client.post(f"/api/v1/integrations/slack/webhook?org_id={org_a.id}", content=body, headers=headers)
    assert resp1.status_code == 200
    assert resp1.json()["status"] == "ingested"

    # Second delivery (replay/retry) -> status: duplicate_ignored
    resp2 = unauth_client.post(f"/api/v1/integrations/slack/webhook?org_id={org_a.id}", content=body, headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "duplicate_ignored"

    # Assert exactly ONE canonical event in DB
    from app.models.canonical_event import CanonicalEventModel
    from app.models.event_outbox import EventOutbox

    events = db.query(CanonicalEventModel).filter(
        CanonicalEventModel.organization_id == org_a.id,
        CanonicalEventModel.external_event_id == event_id,
    ).all()
    assert len(events) == 1

    outboxes = db.query(EventOutbox).filter(
        EventOutbox.organization_id == org_a.id,
        EventOutbox.event_id == events[0].id,
    ).all()
    assert len(outboxes) == 1


def test_disconnect_integration(client_a_admin, db, org_a):
    connector = SlackConnector()
    connector.connect({"access_token": "xoxb-to-disconnect"}, org_a.id, db)

    resp = client_a_admin.post("/api/v1/integrations/slack/disconnect")
    assert resp.status_code == 200
    assert resp.json()["status"] == "disconnected"

    int_acc = db.query(IntegrationAccount).filter(
        IntegrationAccount.organization_id == org_a.id,
        IntegrationAccount.provider == "slack",
    ).first()
    assert int_acc.status == IntegrationStatusEnum.DISCONNECTED.value
    assert int_acc.encrypted_access_token is None
