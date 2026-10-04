import pytest
from unittest.mock import patch, MagicMock
from slack_sdk.errors import SlackApiError

from app.models.slack_connection import SlackConnection
from app.models.event import CompanyEvent
from app.services.slack_service import (
    SlackOAuthService,
    SlackMessageReadingService,
    SLACK_SCOPES,
)
from app.workers.slack_poller_worker import SlackPollerWorker


def test_slack_token_encryption_roundtrip(db, user_a_employee):
    """Test 1: Token encryption and decryption at rest."""
    conn = SlackConnection(
        id="sconn-test-01",
        user_id=user_a_employee.id,
        slack_team_id="T_ALPHA_001",
        slack_user_id="U_ALICE_001",
    )
    secret_token = "xoxb-real-secret-slack-bot-token-998877"
    conn.set_token(secret_token)

    assert conn.access_token != secret_token
    assert "v1:" in conn.access_token

    db.add(conn)
    db.commit()
    db.refresh(conn)

    decrypted = conn.get_token()
    assert decrypted == secret_token


def test_slack_oauth_connect_endpoint(client_a_employee):
    """Test 2: GET /api/slack/connect endpoint returns valid authorization URL with scopes."""
    resp = client_a_employee.get("/api/slack/connect", headers={"Accept": "application/json"})
    assert resp.status_code == 200
    data = resp.json()
    assert "authorization_url" in data
    assert "state" in data

    auth_url = data["authorization_url"]
    assert "https://slack.com/oauth/v2/authorize" in auth_url
    for scope in SLACK_SCOPES:
        assert scope in auth_url


def test_slack_oauth_callback_flow_and_upsert(client_a_employee, user_a_employee, db):
    """Test 3: GET /api/slack/callback exchanges code, stores encrypted token, and enforces 1 active connection."""
    # 1. Generate state for user
    auth_data = SlackOAuthService.get_authorization_url(user_a_employee.id, "http://testserver/api/slack/callback")
    state = auth_data["state"]

    # 2. Call callback with mock code
    resp = client_a_employee.get(f"/api/slack/callback?code=mock_auth_code_123&state={state}")
    assert resp.status_code == 200
    result = resp.json()
    assert result["status"] == "connected"
    assert result["slack_team_id"] == "T04839210"

    # Verify record in DB
    conn = db.query(SlackConnection).filter(
        SlackConnection.user_id == user_a_employee.id,
        SlackConnection.is_active == True,
    ).first()
    assert conn is not None
    assert conn.get_token().startswith("xoxb-mock-slack-token-")
    assert conn.slack_team_id == "T04839210"

    # 3. Connect a second workspace for the same user -> older connection must become inactive
    state2 = SlackOAuthService.generate_state(user_a_employee.id)
    with patch.object(SlackOAuthService, "exchange_code_for_token", return_value={
        "ok": True,
        "access_token": "xoxb-second-workspace-token",
        "team": {"id": "T_NEW_WORKSPACE", "name": "New Team"},
        "authed_user": {"id": "U_NEW_USER"},
    }):
        resp2 = client_a_employee.get(f"/api/slack/callback?code=mock_code_2&state={state2}")
        assert resp2.status_code == 200

    active_conns = db.query(SlackConnection).filter(
        SlackConnection.user_id == user_a_employee.id,
        SlackConnection.is_active == True,
    ).all()
    assert len(active_conns) == 1
    assert active_conns[0].slack_team_id == "T_NEW_WORKSPACE"


def test_slack_multi_user_isolation(client_a_employee, client_b_employee, user_a_employee, user_b_employee, db):
    """Test 4: Multi-user isolation — User A and User B have separate active connections."""
    # Connect for User A
    conn_a = SlackConnection(
        id="sconn-user-a",
        user_id=user_a_employee.id,
        slack_team_id="T_ALPHA",
        is_active=True,
    )
    conn_a.set_token("xoxb-user-a-token")
    db.add(conn_a)

    # Connect for User B
    conn_b = SlackConnection(
        id="sconn-user-b",
        user_id=user_b_employee.id,
        slack_team_id="T_BETA",
        is_active=True,
    )
    conn_b.set_token("xoxb-user-b-token")
    db.add(conn_b)
    db.commit()

    # User A checks status
    resp_a = client_a_employee.get("/api/slack/status")
    assert resp_a.status_code == 200
    data_a = resp_a.json()
    assert data_a["is_connected"] is True
    assert data_a["slack_team_id"] == "T_ALPHA"

    # User B checks status
    resp_b = client_b_employee.get("/api/slack/status")
    assert resp_b.status_code == 200
    data_b = resp_b.json()
    assert data_b["is_connected"] is True
    assert data_b["slack_team_id"] == "T_BETA"


def test_slack_message_deduplication_and_cursor(user_a_employee, db):
    """Test 5: Poller fetches messages, deduplicates via timestamp/cursors, and creates canonical events."""
    import time
    import uuid
    run_id = uuid.uuid4().hex[:6]
    base_ts = time.time()
    ts1 = f"{base_ts:.4f}"
    ts2 = f"{base_ts + 1.0:.4f}"

    conn = SlackConnection(
        id=f"sconn-poller-test-{run_id}",
        user_id=user_a_employee.id,
        slack_team_id=f"T_LIVE_{run_id}",
        is_active=True,
    )
    conn.set_token("xoxb-real-sample-token")
    db.add(conn)
    db.commit()

    mock_client = MagicMock()
    mock_client.conversations_list.return_value = {
        "ok": True,
        "channels": [
            {"id": "C_ENG", "name": "engineering"},
        ],
    }
    mock_client.conversations_history.return_value = {
        "ok": True,
        "messages": [
            {"type": "message", "user": "U_ALICE", "text": "Migrating database to PostgreSQL 16", "ts": ts1},
            {"type": "message", "user": "U_BOB", "text": "Approved security spec update", "ts": ts2},
        ],
    }

    with patch("app.services.slack_service.WebClient", return_value=mock_client):
        res = SlackMessageReadingService.poll_connection(conn, db)
        assert res["status"] == "success"
        assert res["messages_processed"] == 2

        # Verify cursor update
        cursors = conn.get_channel_cursors()
        assert cursors.get("C_ENG") == ts2

        # Verify CompanyEvent created
        events = db.query(CompanyEvent).filter(CompanyEvent.source == "Slack").all()
        assert len(events) >= 2

        # Second poll pass with same messages -> 0 new messages processed (deduplication)
        res2 = SlackMessageReadingService.poll_connection(conn, db)
        assert res2["messages_processed"] == 0


def test_slack_token_revocation_handling(user_a_employee, db):
    """Test 6: SlackApiError with 'token_revoked' or 'invalid_auth' automatically marks connection inactive."""
    conn = SlackConnection(
        id="sconn-revoke-test",
        user_id=user_a_employee.id,
        slack_team_id="T_REVOKE",
        is_active=True,
    )
    conn.set_token("xoxb-revoked-token")
    db.add(conn)
    db.commit()

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.get.return_value = "token_revoked"
    error = SlackApiError(message="token_revoked", response=mock_response)
    mock_client.conversations_list.side_effect = error

    with patch("app.services.slack_service.WebClient", return_value=mock_client):
        res = SlackMessageReadingService.poll_connection(conn, db)
        assert res["status"] == "error"
        assert res["error"] == "token_revoked"

        db.refresh(conn)
        assert conn.is_active is False


def test_slack_disconnect_endpoint(client_a_employee, user_a_employee, db):
    """Test 7: DELETE /api/slack/disconnect deactivates connection."""
    conn = SlackConnection(
        id="sconn-disconnect-test",
        user_id=user_a_employee.id,
        slack_team_id="T_DISC",
        is_active=True,
    )
    conn.set_token("xoxb-token-disc")
    db.add(conn)
    db.commit()

    resp = client_a_employee.delete("/api/slack/disconnect")
    assert resp.status_code == 200
    assert resp.json()["status"] == "disconnected"

    db.refresh(conn)
    assert conn.is_active is False


def test_slack_oauth_custom_redirect_uri_config(client_a_employee):
    """Test 8: SLACK_REDIRECT_URI environment variable dynamically alters authorization URL."""
    from app.core.config import settings
    custom_ngrok = "https://my-tunnel-subdomain.ngrok-free.app/api/slack/callback"
    original_uri = settings.SLACK_REDIRECT_URI

    try:
        settings.SLACK_REDIRECT_URI = custom_ngrok
        resp = client_a_employee.get("/api/slack/connect", headers={"Accept": "application/json"})
        assert resp.status_code == 200
        data = resp.json()
        assert "authorization_url" in data
        assert "https%3A%2F%2Fmy-tunnel-subdomain.ngrok-free.app%2Fapi%2Fslack%2Fcallback" in data["authorization_url"] or custom_ngrok in data["authorization_url"]
    finally:
        settings.SLACK_REDIRECT_URI = original_uri


def test_slack_oauth_x_forwarded_headers_resolution(client_a_employee):
    """Test 9: Dynamic HTTPS redirect URI resolution via reverse proxy headers."""
    from app.core.config import settings
    original_uri = settings.SLACK_REDIRECT_URI
    original_public = settings.PUBLIC_API_URL
    settings.SLACK_REDIRECT_URI = None
    settings.PUBLIC_API_URL = None

    try:
        resp = client_a_employee.get(
            "/api/slack/connect",
            headers={
                "Accept": "application/json",
                "X-Forwarded-Proto": "https",
                "X-Forwarded-Host": "companybrain-demo.ngrok-free.app",
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "https" in data["authorization_url"]
        assert "companybrain-demo.ngrok-free.app" in data["authorization_url"]
    finally:
        settings.SLACK_REDIRECT_URI = original_uri
        settings.PUBLIC_API_URL = original_public

