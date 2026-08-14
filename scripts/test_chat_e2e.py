import asyncio
import json
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.chat_session import ChatSessionModel, ChatMessageModel

client = TestClient(app)


def test_chat_e2e():
    print("\n--- 1. Testing GET /api/v1/chat/models ---")
    res = client.get("/api/v1/chat/models")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    models_data = res.json()
    print(f"Active default model: {models_data.get('active_default')}")
    assert len(models_data.get("models", [])) >= 4

    print("\n--- 2. Testing POST /api/v1/chat (Standard endpoint with RAG citations) ---")
    chat_payload = {
        "message": "Why is there a contradiction in payment authentication between JWT and OAuth2?",
        "provider": "cognitive"
    }
    res = client.post("/api/v1/chat", json=chat_payload)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.json()
    session_id = data.get("session_id")
    assert session_id is not None, "session_id missing"
    assert data.get("engine") == "cognitive-nlp-engine"
    assert "sources" in data
    print(f"Chat Session Created: {session_id}")
    print(f"Engine: {data.get('engine')}")
    print(f"Citations count: {len(data.get('sources', []))}")
    print(f"Reply Preview: {data.get('reply')[:90].encode('ascii', errors='replace').decode()}...")

    print("\n--- 3. Testing POST /api/v1/chat/stream (SSE Streaming endpoint) ---")
    stream_payload = {
        "message": "Detail the first conflict and recommend next steps",
        "session_id": session_id,
        "provider": "cognitive"
    }
    
    with client.stream("POST", "/api/v1/chat/stream", json=stream_payload) as stream_res:
        assert stream_res.status_code == 200
        assert "text/event-stream" in stream_res.headers.get("content-type", "")
        
        chunks = []
        done_event = None
        for line in stream_res.iter_lines():
            if line.startswith("data: "):
                payload = json.loads(line[6:])
                if not payload.get("done"):
                    chunks.append(payload.get("chunk", ""))
                else:
                    done_event = payload
        
        print(f"SSE Chunks received: {len(chunks)}")
        assert done_event is not None, "Done event not received"
        assert done_event.get("done") is True
        print(f"Stream completed with engine: {done_event.get('engine')}")

    print("\n--- 4. Testing Session Persistence & CRUD ---")
    # Verify session history in DB
    db = SessionLocal()
    try:
        db_sess = db.query(ChatSessionModel).filter(ChatSessionModel.id == session_id).first()
        assert db_sess is not None, "Session not saved in database"
        assert db_sess.message_count >= 4, f"Expected >= 4 messages, got {db_sess.message_count}"
        print(f"Database verified messages in session: {db_sess.message_count}")
    finally:
        db.close()

    # GET /api/v1/chat/sessions
    res_list = client.get("/api/v1/chat/sessions")
    assert res_list.status_code == 200
    sessions_list = res_list.json().get("sessions", [])
    matching = [s for s in sessions_list if s["session_id"] == session_id]
    assert len(matching) > 0, "Session not found in list_sessions"
    print(f"Session list retrieval OK, total sessions: {len(sessions_list)}")

    # PATCH /api/v1/chat/session/{id} (Rename)
    res_rename = client.patch(f"/api/v1/chat/session/{session_id}", json={"title": "Renamed Payment Discussion"})
    assert res_rename.status_code == 200
    assert res_rename.json().get("title") == "Renamed Payment Discussion"
    print("Session rename OK")

    # DELETE /api/v1/chat/session/{id}
    res_del = client.delete(f"/api/v1/chat/session/{session_id}")
    assert res_del.status_code == 200
    assert res_del.json().get("deleted") is True
    print("Session delete OK")

    print("\n[ALL E2E INTEGRATION TESTS PASSED SUCCESSFULLY]")


if __name__ == "__main__":
    test_chat_e2e()
