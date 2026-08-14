import urllib.request
import json
import time

base = "http://127.0.0.1:8000"

for _ in range(12):
    try:
        with urllib.request.urlopen(base + "/api/v1/health", timeout=2) as resp:
            if resp.status == 200:
                break
    except Exception:
        time.sleep(1)


def get(path):
    with urllib.request.urlopen(base + path) as r:
        return json.loads(r.read().decode())


def post(path, body={}):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        base + path,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


results = []

# 1. Health
h = get("/api/v1/health")
assert h["status"] == "ok"
results.append(("GET /api/v1/health", "PASS", h["service"]))

# 2. Knowledge Health
kh = get("/api/v1/knowledge/health")
assert kh["open_conflicts"] == 3
results.append(("GET /api/v1/knowledge/health", "PASS", f"{kh['knowledge_health']}% health, {kh['open_conflicts']} open conflicts"))

# 3. Documents
docs = get("/api/v1/documents")
assert len(docs["documents"]) == 4
results.append(("GET /api/v1/documents", "PASS", f"{len(docs['documents'])} documents loaded from DB"))

# 4. Events
evts = get("/api/v1/events")
assert len(evts["events"]) == 5
results.append(("GET /api/v1/events", "PASS", f"{len(evts['events'])} events from DB"))

# 5. Conflicts
confs = get("/api/v1/conflicts")
assert len(confs["conflicts"]) == 3
results.append(("GET /api/v1/conflicts", "PASS", f"{len(confs['conflicts'])} enriched conflicts"))

# 6. Multi-Agent System
agents = get("/api/v1/agents")
assert len(agents["agents"]) == 4
results.append(("GET /api/v1/agents", "PASS", f"{len(agents['agents'])} specialized domain agents"))

# 7. Intelligence Core Telemetry
intel = get("/api/v1/intelligence/health")
assert intel["rag_engine"]["status"] == "active"
results.append(("GET /api/v1/intelligence/health", "PASS", f"RAG: {intel['rag_engine']['total_chunks']} chunks, KG: {intel['knowledge_graph']['nodes']} nodes"))

# 8. Context Memory Store
mem = get("/api/v1/intelligence/memory")
assert len(mem["company_context"]) == 12
results.append(("GET /api/v1/intelligence/memory", "PASS", f"{len(mem['short_term'])} short-term, {len(mem['company_context'])} context keys"))

# 9. Processing Pipeline Telemetry
pipe = get("/api/v1/pipeline/status")
assert pipe["pipeline_orchestrator"]["backend"] == "LangGraph"
results.append(("GET /api/v1/pipeline/status", "PASS", f"Orchestrator: {pipe['pipeline_orchestrator']['backend']}, EventBus: {pipe['event_bus']['backend']}"))

# 10. Data Foundation Telemetry
dfn = get("/api/v1/data-foundation")
assert dfn["postgresql"]["status"] == "active"
results.append(("GET /api/v1/data-foundation", "PASS", f"Postgres: {dfn['postgresql']['row_count']} rows, Neo4j: {dfn['neo4j']['nodes']} nodes"))

# 11. Pre-Approval Risk & Policy Check
rk = get("/api/v1/conflicts/conflict-auth-method/risk-check")
assert rk["approved_to_proceed"] is True
results.append(("GET /api/v1/conflicts/.../risk-check", "PASS", f"Risk: {rk['risk_level']}, Approver: {rk['required_approver']}, Passed: {len(rk['rules'])}/5"))

# 12. Approval Execution
appr = post("/api/v1/conflicts/conflict-auth-method/approve", {"reason": "FastAPI prototype verification"})
assert appr["conflict"]["status"] == "approved"
assert len(appr["workflows"]) == 5
results.append(("POST /api/v1/conflicts/.../approve", "PASS", f"{len(appr['workflows'])} actions executed across KB/Jira/Slack/GitHub"))

# 13. Workflows Timeline
wf = get("/api/v1/workflows")
assert len(wf["workflows"]) == 5
results.append(("GET /api/v1/workflows", "PASS", f"{len(wf['workflows'])} workflow actions registered"))

# 14. Audit Log Verification
al = get("/api/v1/audit-logs")
assert len(al["audit_logs"]) >= 1
results.append(("GET /api/v1/audit-logs", "PASS", f"{len(al['audit_logs'])} immutable audit log entries in DB"))

# 15. State Reset
rst = post("/api/v1/demo/reset")
assert rst["ok"] is True
results.append(("POST /api/v1/demo/reset", "PASS", "Database reset to baseline state"))

print()
print("  COMPANY BRAIN OS — FASTAPI PROTOTYPE LIVE ENDPOINT AUDIT")
print("  " + "=" * 72)
for name, status, detail in results:
    print(f"  {status}  {name:<38} {detail}")
print("  " + "=" * 72)
print(f"  All {len(results)} live FastAPI prototype endpoints validated!")
print()
