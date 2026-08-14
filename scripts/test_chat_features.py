import asyncio
import json
from app.core.database import init_db, SessionLocal
from app.models.chat_session import ChatSessionModel, ChatMessageModel
from app.services.layer2_intelligence.rag_engine import RAGEngineService
from app.services.layer2_intelligence.nlp_chat_engine import NLPChatEngine


async def test_backend_features():
    print("\n--- 1. Testing DB Initialization & Chunk Seeding ---")
    init_db()
    db = SessionLocal()
    try:
        chunks_created = RAGEngineService.seed_document_chunks(db)
        print(f"Document Chunks Seeded: {chunks_created}")

        print("\n--- 2. Testing Hybrid RAG Semantic Retrieval ---")
        query = "payment service authentication JWT to OAuth2"
        rag_ctx, citations = RAGEngineService.get_rag_context(db, query, top_k=3)
        print(f"Retrieved {len(citations)} citations for query: '{query}'")
        for idx, cit in enumerate(citations):
            print(f"  [{idx+1}] {cit['title']} (Score: {round(cit['score']*100)}%) - ID: {cit['document_id']}")

        print("\n--- 3. Testing NLPChatEngine Streaming (SSE Generator) ---")
        chunks_streamed = []
        final_envelope = None

        async for sse_chunk in NLPChatEngine.chat_stream(
            message="Explain the payment conflict and what evidence was detected",
            db=db,
            history=[]
        ):
            data = json.loads(sse_chunk)
            if not data.get("done"):
                chunks_streamed.append(data.get("chunk", ""))
            else:
                final_envelope = data

        full_streamed_text = "".join(chunks_streamed)
        print(f"Streamed {len(chunks_streamed)} chunk tokens.")
        print(f"Sample Stream Content (first 100 chars): {full_streamed_text[:100].encode('ascii', errors='replace').decode()}...")
        print(f"Final Envelope: Engine={final_envelope.get('engine')}, Citations Count={len(final_envelope.get('sources', []))}")



        print("\n--- 4. Testing ChatSession Persistence in Database ---")
        test_session = ChatSessionModel(
            id="test-session-persist-001",
            title="Automated Test Session",
            message_count=2
        )
        db.merge(test_session)
        msg1 = ChatMessageModel(
            id="test-msg-001",
            session_id="test-session-persist-001",
            role="user",
            text="Hello test",
        )
        msg2 = ChatMessageModel(
            id="test-msg-002",
            session_id="test-session-persist-001",
            role="bot",
            text="Hello from bot",
            engine="cognitive-nlp-engine",
        )
        msg2.sources = [{"title": "Payment Architecture", "score": 0.95}]
        db.merge(msg1)
        db.merge(msg2)
        db.commit()

        # Query back
        reloaded_session = db.query(ChatSessionModel).filter(ChatSessionModel.id == "test-session-persist-001").first()
        assert reloaded_session is not None, "Session failed to persist in DB"
        assert len(reloaded_session.messages) == 2, f"Expected 2 messages, found {len(reloaded_session.messages)}"
        assert reloaded_session.messages[1].sources[0]["title"] == "Payment Architecture"
        print("[OK] Session & message persistence verified successfully!")

        # Clean up test session
        db.delete(reloaded_session)
        db.commit()
        print("[OK] Test cleanup complete.")


    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(test_backend_features())
