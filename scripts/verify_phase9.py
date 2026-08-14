import urllib.request, json

base = "http://127.0.0.1:8000"

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

h = get("/api/health")
assert h["status"] == "ok"
results.append(("GET /api/health", "PASS", h["status"]))

kh = get("/api/knowledge/health")
assert kh["open_conflicts"] == 3
results.append(("GET /api/knowledge/health", "PASS",
    f"{kh['knowledge_health']}% health, {kh['open_conflicts']} open conflicts"))

docs = get("/api/documents")
assert len(docs["documents"]) >= 1
results.append(("GET /api/documents", "PASS", f"{len(docs['documents'])} documents"))

evts = get("/api/events")
assert len(evts["events"]) >= 1
results.append(("GET /api/events", "PASS", f"{len(evts['events'])} events"))

confs = get("/api/conflicts")
assert len(confs["conflicts"]) == 3
results.append(("GET /api/conflicts", "PASS", f"{len(confs['conflicts'])} conflicts"))

c1 = get("/api/conflicts/conflict-auth-method")
assert c1["conflict"]["confidence"] >= 80
assert "OAuth2" in c1["conflict"]["recommended_update"]
results.append(("GET /api/conflicts/{id}", "PASS",
    f"confidence={c1['conflict']['confidence']}%"))

a = post("/api/conflicts/conflict-auth-method/approve", {"reason": "Phase 9 test"})
assert a["conflict"]["status"] == "approved"
assert len(a["workflows"]) == 4
results.append(("POST .../approve", "PASS",
    f"status=approved, {len(a['workflows'])} workflows created"))

wf = get("/api/workflows")
assert len(wf["workflows"]) == 4
tools = ", ".join(w["tool"] for w in wf["workflows"])
results.append(("GET /api/workflows", "PASS", f"{len(wf['workflows'])} actions: {tools}"))

al = get("/api/audit-logs")
assert len(al["audit_logs"]) >= 1
results.append(("GET /api/audit-logs", "PASS", f"{len(al['audit_logs'])} log entries"))

r = post("/api/demo/reset")
assert r["ok"] is True
results.append(("POST /api/demo/reset", "PASS", r["message"]))

kh2 = get("/api/knowledge/health")
assert kh2["open_conflicts"] == 3
results.append(("Reset verification", "PASS",
    f"back to {kh2['open_conflicts']} open conflicts"))

print()
print("  PHASE 9 - END-TO-END VERIFICATION RESULTS")
print("  " + "=" * 60)
for name, status, detail in results:
    print(f"  {status}  {name:<38} {detail}")
print("  " + "=" * 60)
print(f"  All {len(results)} checks passed.")
print()
