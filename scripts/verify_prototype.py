import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.database import init_db, SessionLocal
from app.services.layer1_data.db_service import DataService
from app.services.layer1_data.vector_store import VectorStoreService, KnowledgeGraphStoreService
from app.services.layer2_intelligence.rag_engine import RAGEngineService
from app.services.layer2_intelligence.conflict_detector import ConflictDetectorService
from app.services.layer2_intelligence.multi_agent import MultiAgentService
from app.services.layer2_intelligence.memory_store import MemoryStoreService
from app.services.layer3_pipeline.event_bus import EventBusService
from app.services.layer0_execution.policy_engine import PolicyEngineService
from app.services.layer0_execution.action_executor import ActionExecutorService
from app.api.v1.endpoints.demo import reset_and_seed_db


def require(cond, msg):
    if not cond:
        raise AssertionError(msg)


def main():
    init_db()
    db = SessionLocal()
    results = []

    try:
        # Reset to clean baseline
        reset_and_seed_db(db)

        # 1. Layer 1 — Data Foundation
        docs = DataService.get_documents(db)
        events = DataService.get_events(db)
        conflicts = DataService.get_conflicts(db)
        agents = DataService.get_agents(db)

        require(len(docs) >= 4, "Expected at least 4 documents")
        require(len(events) >= 5, "Expected at least 5 events")
        require(len(conflicts) == 3, "Expected 3 conflicts")
        require(len(agents) == 4, "Expected 4 agents")
        results.append(("Layer 1: Database CRUD Models", "PASS", f"{len(docs)} docs, {len(events)} events, {len(conflicts)} conflicts, {len(agents)} agents"))

        # 2. Layer 1 — Vector & Graph Telemetry
        vec_stats = VectorStoreService.get_stats(db)
        kg_stats = KnowledgeGraphStoreService.get_stats(db)
        require(vec_stats["total_embeddings"] > 0, "Expected vector embeddings")
        require(kg_stats["nodes"] > 0, "Expected graph nodes")
        results.append(("Layer 1: Vector & Graph Telemetry", "PASS", f"pgvector: {vec_stats['total_embeddings']} embeddings, Neo4j: {kg_stats['nodes']} nodes"))

        # 3. Layer 2 — RAG Hybrid Search
        search_res = RAGEngineService.hybrid_search(db, "OAuth2 JWT payment authentication", top_k=2)
        require(len(search_res) > 0, "Expected hybrid search results")
        results.append(("Layer 2: RAG Hybrid Search Engine", "PASS", f"Top match: '{search_res[0]['title']}' (Score: {search_res[0]['score']})"))

        # 4. Layer 2 — Conflict Contradiction Scoring & Enrichment
        primary_conf = next(c for c in conflicts if c.id == "conflict-auth-method")
        enriched = ConflictDetectorService.enrich_conflict(db, primary_conf)
        require(enriched["confidence"] >= 80, "Expected high confidence score")
        require(enriched["detected_by_agent"] is not None, "Expected detected_by_agent object")
        results.append(("Layer 2: Contradiction Detection", "PASS", f"Confidence={enriched['confidence']}%, Contradiction={primary_conf.contradiction_score}, Agent={enriched['detected_by_agent']['name']}"))

        # 5. Layer 2 — Multi-Agent System
        agent_summaries = MultiAgentService.get_agent_summaries(db)
        active_agents = [a for a in agent_summaries if a["status"] == "active"]
        require(len(active_agents) >= 2, "Expected active domain agents")
        results.append(("Layer 2: Multi-Agent System", "PASS", f"{len(agent_summaries)} agents loaded ({len(active_agents)} active)"))

        # 6. Layer 2 — Memory & Context Store
        mem = MemoryStoreService.get_memory(db)
        require(len(mem["short_term"]) > 0, "Expected short-term memory")
        require(len(mem["company_context"]) > 0, "Expected company context keys")
        results.append(("Layer 2: Memory & Context Store", "PASS", f"{len(mem['short_term'])} short-term items, {len(mem['company_context'])} context keys"))

        # 7. Layer 3 — Event Bus & Pipeline
        pipeline = EventBusService.get_stats(db)
        require(pipeline["event_bus"]["status"] == "active", "Event bus should be active")
        require(pipeline["pipeline_orchestrator"]["backend"] == "LangGraph", "Expected LangGraph orchestrator")
        results.append(("Layer 3: Processing Pipeline", "PASS", f"EventBus: {pipeline['event_bus']['messages_processed']} msgs, Orchestrator: {pipeline['pipeline_orchestrator']['backend']}"))

        # 8. Layer 0 — Risk & Policy Check
        status_code, risk_eval = PolicyEngineService.evaluate_risk(db, "conflict-auth-method")
        require(status_code == 200, "Risk check should return 200")
        require(risk_eval["approved_to_proceed"] is True, "Expected policy approval to proceed")
        results.append(("Layer 0: Risk & Policy Engine", "PASS", f"Risk: {risk_eval['risk_level']}, Approver: {risk_eval['required_approver']}, Rules passed: {len(risk_eval['rules'])}"))

        # 9. Layer 0 — Approval Execution & Workflows
        status_code, exec_res = ActionExecutorService.apply_approval(db, "conflict-auth-method", "approve", "Prototype verification")
        require(status_code == 200, "Approval should succeed")
        require(exec_res["conflict"]["status"] == "approved", "Conflict should be marked approved")
        require(len(exec_res["workflows"]) == 5, "Expected 5 workflow actions (RiskCheck + Doc + Jira + Slack + GitHub)")
        
        audit_logs = DataService.get_audit_logs(db)
        require(len(audit_logs) >= 1, "Expected audit log record")
        results.append(("Layer 0: Action Execution & Audit", "PASS", f"{len(exec_res['workflows'])} workflow actions dispatched, Audit ID: {audit_logs[0].id}"))

        # 10. Database Reset
        reset_and_seed_db(db)
        conflicts_after = DataService.get_conflicts(db, status="open")
        require(len(conflicts_after) == 3, "Expected 3 open conflicts after reset")
        results.append(("Baseline State Reset", "PASS", f"Successfully reset to {len(conflicts_after)} open conflicts"))

        print()
        print("  COMPANY BRAIN OS — PROTOTYPE INTEGRATION TEST SUITE")
        print("  " + "=" * 70)
        for name, status, detail in results:
            print(f"  {status}  {name:<36} {detail}")
        print("  " + "=" * 70)
        print(f"  All {len(results)} integration tests passed successfully!")
        print()

    finally:
        db.close()


if __name__ == "__main__":
    main()
