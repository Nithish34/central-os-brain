import urllib.request, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
import app

# ── Reset to clean state ─────────────────────────────────────────────────
app.STATE.clear()
app.STATE.update(app.deepcopy(app.INITIAL_STATE))

def require(cond, msg):
    if not cond:
        raise AssertionError(msg)

results = []

# 1. Health
h = app.knowledge_health()
require(h["open_conflicts"] == 3, "Expected 3 open conflicts")
require(h["stale_documents"] >= 2, "Expected stale documents")
results.append(("knowledge_health()", "PASS", f"{h['knowledge_health']}% health, {h['open_conflicts']} conflicts"))

# 2. Layer 2 — Intelligence Core
intel = app.intelligence_health()
require(intel["rag_engine"]["status"] == "active",         "RAG engine should be active")
require(intel["rag_engine"]["total_chunks"] > 0,           "RAG should have chunks")
require(intel["knowledge_graph"]["nodes"] > 0,             "Knowledge graph should have nodes")
require(intel["conflict_detection"]["conflicts_found"] > 0, "Should detect conflicts")
require(intel["memory_store"]["status"] == "active",       "Memory store should be active")
results.append(("intelligence_health()", "PASS",
    f"RAG:{intel['rag_engine']['total_chunks']} chunks, KG:{intel['knowledge_graph']['nodes']} nodes"))

# 3. Layer 2 — Agents
agents = app.get_agents()
require(len(agents) == 4, "Should have 4 agents")
active_agents = [a for a in agents if a["status"] == "active"]
require(len(active_agents) == 2, "Should have 2 active agents")
eng_agent = next(a for a in agents if a["id"] == "agent-engineering")
require(eng_agent["conflicts_detected"] == 2, "Engineering agent should have 2 conflicts")
results.append(("get_agents()", "PASS",
    f"{len(agents)} agents, {len(active_agents)} active"))

# 4. Layer 2 — Conflict enrichment (agent + scores)
conflicts = [app.enrich_conflict(c) for c in app.STATE["conflicts"]]
primary = next(c for c in conflicts if c["id"] == "conflict-auth-method")
require(primary["confidence"] >= 80,                          "Primary conflict should have high confidence")
require("OAuth2" in primary["recommended_update"],            "Should mention OAuth2")
require(primary["detected_by_agent"] is not None,            "Should have detected_by agent")
require(primary["contradiction_score"] > 0.5,                "Should have contradiction score")
require(primary["risk_level"] == "HIGH",                     "Auth conflict should be HIGH risk")
results.append(("enrich_conflict() L2", "PASS",
    f"confidence={primary['confidence']}%, agent={primary['detected_by_agent']['name']}, risk={primary['risk_level']}"))

# 5. Layer 3 — Pipeline status
pipeline = app.pipeline_status()
require(pipeline["event_bus"]["status"] == "active",           "Event bus should be active")
require(pipeline["background_workers"]["workers_online"] > 0,  "Should have workers online")
require(pipeline["event_router"]["status"] == "active",        "Event router should be active")
require(pipeline["pipeline_orchestrator"]["backend"] == "LangGraph", "Should use LangGraph")
require(len(pipeline["event_stages"]) > 0,                    "Should have event stages")
results.append(("pipeline_status() L3", "PASS",
    f"EventBus:{pipeline['event_bus']['messages_processed']} msgs, Workers:{pipeline['background_workers']['workers_online']}"))

# 6. Layer 0 — Risk Check
status, rcheck = app.risk_check("conflict-auth-method")
require(status == 200,                          "Risk check should return 200")
require(rcheck["risk_level"] == "HIGH",         "Auth conflict risk should be HIGH")
require(rcheck["approved_to_proceed"] is True,  "Should be approved to proceed")
require(len(rcheck["rules"]) > 0,               "Should have rules")
all_passed = all(r["passed"] for r in rcheck["rules"])
require(all_passed, "All rules should pass for primary conflict")
results.append(("risk_check() L0", "PASS",
    f"risk={rcheck['risk_level']}, rules={len(rcheck['rules'])} all passed={all_passed}"))

# 7. Layer 1 — Data Foundation
dfn = app.data_foundation_stats()
require(dfn["postgresql"]["status"] == "active",  "PostgreSQL should be active")
require(dfn["pgvector"]["embeddings"] > 0,        "pgvector should have embeddings")
require(dfn["neo4j"]["nodes"] > 0,                "Neo4j should have nodes")
require(dfn["redis"]["status"] == "active",       "Redis should be active")
require(dfn["s3_minio"]["status"] == "active",    "S3/MinIO should be active")
results.append(("data_foundation_stats() L1", "PASS",
    f"PG:{dfn['postgresql']['row_count']} rows, pgvec:{dfn['pgvector']['embeddings']} embeddings, Neo4j:{dfn['neo4j']['nodes']} nodes"))

# 8. Layer 0 — Approve → 5 workflows (risk+doc+jira+slack+github)
status, result = app.apply_approval("conflict-auth-method", "approve", "Smoke test approval")
require(status == 200,                                    "Approval should succeed")
require(result["conflict"]["status"] == "approved",       "Conflict should be approved")
require(len(result["workflows"]) == 5,                    "Should create 5 workflow actions (risk+doc+jira+slack+github)")
require(len(app.STATE["audit_logs"]) == 1,                "Should create 1 audit log entry")
wf_tools = [w["tool"] for w in result["workflows"]]
require("Risk & Policy Engine" in wf_tools,  "Workflow should include Risk & Policy Engine step")
require("Jira" in wf_tools,                  "Workflow should include Jira")
require("Slack" in wf_tools,                 "Workflow should include Slack")
require("GitHub" in wf_tools,                "Workflow should include GitHub")
results.append(("apply_approval() L0", "PASS",
    f"5 workflows: {', '.join(wf_tools)}"))

# 9. Memory store
mem = app.get_memory()
require(len(mem["short_term"]) > 0,       "Should have short-term memory")
require(len(mem["company_context"]) > 0,  "Should have company context")
results.append(("get_memory() L2", "PASS",
    f"{len(mem['short_term'])} short-term, {len(mem['company_context'])} context keys"))

# 10. Reset
app.STATE.clear()
app.STATE.update(app.deepcopy(app.INITIAL_STATE))
h2 = app.knowledge_health()
require(h2["open_conflicts"] == 3, "After reset should have 3 open conflicts again")
results.append(("demo reset", "PASS", f"back to {h2['open_conflicts']} open conflicts"))

# ── Report ──────────────────────────────────────────────────────────────
print()
print("  COMPANY BRAIN OS — LAYERS 0-3 SMOKE TEST")
print("  " + "=" * 66)
for name, status, detail in results:
    print(f"  {status}  {name:<38} {detail}")
print("  " + "=" * 66)
print(f"  All {len(results)} checks passed. Layers 0-3 are ready for demo.")
print()
