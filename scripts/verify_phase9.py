import urllib.request, json, time

base = "http://127.0.0.1:8000"

# Wait for server
for i in range(10):
    try:
        urllib.request.urlopen(base + "/api/health", timeout=2)
        break
    except Exception:
        time.sleep(1)

def get(path):
    with urllib.request.urlopen(base + path) as r:
        return json.loads(r.read())

def post(path, body={}):
    data = json.dumps(body).encode()
    req = urllib.request.Request(base + path, data=data,
          headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

results = []

# Existing endpoints
h  = get("/api/health");          assert h["status"] == "ok";           results.append(("GET /api/health",            "PASS", "ok"))
kh = get("/api/knowledge/health");assert kh["open_conflicts"] == 3;     results.append(("GET /api/knowledge/health", "PASS", f"{kh['knowledge_health']}%"))
docs=get("/api/documents");       assert len(docs["documents"]) >= 1;   results.append(("GET /api/documents",         "PASS", f"{len(docs['documents'])} docs"))
evts=get("/api/events");          assert len(evts["events"]) >= 1;      results.append(("GET /api/events",           "PASS", f"{len(evts['events'])} events"))

# Layer 2 — Intelligence Core
intel=get("/api/intelligence/health")
assert intel["rag_engine"]["status"] == "active"
results.append(("GET /api/intelligence/health", "PASS", f"RAG chunks={intel['rag_engine']['total_chunks']}, KG nodes={intel['knowledge_graph']['nodes']}"))

agents=get("/api/agents")
assert len(agents["agents"]) == 4
results.append(("GET /api/agents", "PASS", f"{len(agents['agents'])} agents"))

mem=get("/api/memory")
assert len(mem["company_context"]) > 0
results.append(("GET /api/memory", "PASS", f"{len(mem['short_term'])} short-term, {len(mem['company_context'])} context keys"))

# Layer 3 — Pipeline
pipe=get("/api/pipeline/status")
assert pipe["pipeline_orchestrator"]["backend"] == "LangGraph"
results.append(("GET /api/pipeline/status", "PASS", f"Workers:{pipe['background_workers']['workers_online']}, Orchestrator:{pipe['pipeline_orchestrator']['backend']}"))

# Layer 1 — Data Foundation
dfn=get("/api/data-foundation")
assert dfn["neo4j"]["nodes"] > 0
results.append(("GET /api/data-foundation", "PASS", f"PG rows={dfn['postgresql']['row_count']}, pgvec={dfn['pgvector']['embeddings']}, Neo4j={dfn['neo4j']['nodes']}"))

# Layer 0 — Risk Check
rk=get("/api/risk-check/conflict-auth-method")
assert rk["risk_level"] == "HIGH"
results.append(("GET /api/risk-check/{id}", "PASS", f"risk={rk['risk_level']}, proceed={rk['approved_to_proceed']}"))

# Conflicts with enrichment
c1=get("/api/conflicts/conflict-auth-method")
assert c1["conflict"]["detected_by_agent"]["name"] == "Engineering Agent"
assert c1["conflict"]["contradiction_score"] > 0.5
results.append(("GET /api/conflicts/{id} L2", "PASS", f"agent={c1['conflict']['detected_by_agent']['name']}, contradiction={c1['conflict']['contradiction_score']}"))

# Approval → 5 workflows
a=post("/api/conflicts/conflict-auth-method/approve", {"reason": "live verify"})
assert a["conflict"]["status"] == "approved"
assert len(a["workflows"]) == 5
tools=[w["tool"] for w in a["workflows"]]
assert "Risk & Policy Engine" in tools
results.append(("POST .../approve", "PASS", f"{len(a['workflows'])} workflows: {', '.join(tools)}"))

# Audit log
al=get("/api/audit-logs"); assert len(al["audit_logs"]) >= 1
results.append(("GET /api/audit-logs", "PASS", f"{len(al['audit_logs'])} entries"))

# Reset
r=post("/api/demo/reset"); assert r["ok"] is True
kh2=get("/api/knowledge/health"); assert kh2["open_conflicts"] == 3
results.append(("POST /api/demo/reset + verify", "PASS", f"back to {kh2['open_conflicts']} open conflicts"))

print()
print("  COMPANY BRAIN OS — LAYERS 0-3 LIVE ENDPOINT VERIFICATION")
print("  " + "=" * 68)
for name, status, detail in results:
    print(f"  {status}  {name:<40} {detail}")
print("  " + "=" * 68)
print(f"  All {len(results)} live checks passed. Demo ready at http://127.0.0.1:8000")
print()
