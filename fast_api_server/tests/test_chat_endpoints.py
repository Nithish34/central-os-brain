import json
import pytest
from app.models.chat_session import ChatSessionModel, ChatMessageModel


def test_chat_standard_endpoint(client_a_owner, db, org_a):
    payload = {
        "message": "What was discussed in the Slack channels?",
        "provider": "auto",
    }
    resp = client_a_owner.post("/api/v1/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "reply" in data
    assert "session_id" in data
    assert data["message_count"] >= 2  # user msg + bot reply

    # Verify session and messages are persisted in DB
    session = db.query(ChatSessionModel).filter(ChatSessionModel.id == data["session_id"]).first()
    assert session is not None
    assert session.organization_id == org_a.id

    messages = db.query(ChatMessageModel).filter(ChatMessageModel.session_id == data["session_id"]).all()
    assert len(messages) >= 2


def test_chat_stream_endpoint(client_a_owner, db, org_a):
    payload = {
        "message": "Give me a summary of conflicts in the system",
        "provider": "auto",
    }
    resp = client_a_owner.post("/api/v1/chat/stream", json=payload)
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers.get("content-type", "")

    # Read SSE lines
    content = resp.text
    assert "data:" in content
    assert "done" in content


def test_chat_session_lifecycle(client_a_owner, db, org_a):
    # 1. Create new session
    resp = client_a_owner.post("/api/v1/chat/sessions/new", json={"title": "Architecture Review"})
    assert resp.status_code == 200
    session_data = resp.json()
    session_id = session_data["session_id"]
    assert session_data["title"] == "Architecture Review"

    # 2. List sessions
    resp_list = client_a_owner.get("/api/v1/chat/sessions")
    assert resp_list.status_code == 200
    sessions = resp_list.json()["sessions"]
    assert any(s["session_id"] == session_id for s in sessions)

    # 3. Get session history
    resp_get = client_a_owner.get(f"/api/v1/chat/session/{session_id}")
    assert resp_get.status_code == 200
    assert resp_get.json()["session_id"] == session_id

    # 4. Rename session
    resp_rename = client_a_owner.patch(f"/api/v1/chat/session/{session_id}", json={"title": "Updated Review"})
    assert resp_rename.status_code == 200
    assert resp_rename.json()["title"] == "Updated Review"

    # 5. Delete session
    resp_del = client_a_owner.delete(f"/api/v1/chat/session/{session_id}")
    assert resp_del.status_code == 200
    assert resp_del.json()["ok"] is True
