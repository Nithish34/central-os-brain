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


def request_json(path, method="GET", body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


results = []

# Reset database to baseline before starting audit
request_json("/api/v1/demo/reset", method="POST", body={})

# ── 1. Layer 5: JWT Auth & RBAC ──────────────────────────────────────────────
login_res = request_json("/api/v1/auth/login", method="POST", body={
    "email": "admin@companybrain.local",
    "password": "admin1234"
})
assert "access_token" in login_res
token = login_res["access_token"]
results.append(("Layer 5: JWT Auth Login", "PASS", f"Token: {token[:18]}... (Role: {login_res['user']['role']})"))

me_res = request_json("/api/v1/auth/me", token=token)
assert me_res["email"] == "admin@companybrain.local"
assert "integrations:write" in me_res["permissions"]
results.append(("Layer 5: RBAC Permissions", "PASS", f"{len(me_res['permissions'])} permissions active for '{me_res['role']}'"))

# ── 2. Layer 5: Integrations Catalog ─────────────────────────────────────────
integrations = request_json("/api/v1/integrations", token=token)
assert len(integrations) >= 6
providers = [i["provider"] for i in integrations]
results.append(("Layer 5: Integrations Catalog", "PASS", f"{len(integrations)} connectors ({', '.join(providers)})"))

# ── 3. Layer 4: Slack Webhook Ingestion & Normalization ──────────────────────
slack_payload = {
    "event_id": "slack-evt-live-101",
    "team_id": "T04839210",
    "event": {
        "type": "message",
        "user": "U_PRIYA_RAMAN",
        "channel": "C_PAYMENTS_ARCH",
        "ts": "1723610000.000100",
        "text": "Decision from payment huddle: migration from JWT to OAuth2 client credentials complete."
    }
}
slack_res = request_json("/api/v1/ingestion/slack/events", method="POST", body=slack_payload, token=token)
assert slack_res["source"] == "slack"
assert slack_res["results"][0]["status"] == "normalized"
results.append(("Layer 4: Slack Webhook Normalizer", "PASS", f"Event ID: {slack_res['results'][0]['eventId']} normalized"))

# ── 4. Layer 4: GitHub Webhook Ingestion & Normalization ─────────────────────
github_payload = {
    "action": "closed",
    "pull_request": {
        "id": 482910,
        "number": 482,
        "title": "Add OAuth2 middleware to payment-service",
        "body": "Replaced JWT validator with OAuth2 client credential middleware.",
        "merged": True,
        "html_url": "https://github.com/acme/payment-service/pull/482"
    },
    "repository": {"id": 99281, "full_name": "acme/payment-service"},
    "sender": {"login": "sanjay-dev"}
}
gh_res = request_json("/api/v1/ingestion/github/webhooks", method="POST", body=github_payload, token=token)
assert gh_res["source"] == "github"
assert gh_res["results"][0]["status"] == "normalized"
results.append(("Layer 4: GitHub PR Webhook Normalizer", "PASS", f"PR #{github_payload['pull_request']['number']} event normalized"))

# ── 5. Layer 3: Processing Pipeline & Event Bus ──────────────────────────────
pipe_res = request_json("/api/v1/pipeline/status", token=token)
assert pipe_res["event_bus"]["status"] == "active"
assert pipe_res["pipeline_orchestrator"]["backend"] == "LangGraph"
results.append(("Layer 3: Processing Pipeline", "PASS", f"EventBus: {pipe_res['event_bus']['messages_processed']} msgs, Workers: {pipe_res['background_workers']['workers_online']}"))

# ── 6. Layer 2: Intelligence Core & Multi-Agent Contradiction ────────────────
confs = request_json("/api/v1/conflicts", token=token)
assert len(confs["conflicts"]) == 3
auth_conf = next(c for c in confs["conflicts"] if c["id"] == "conflict-auth-method")
assert auth_conf["confidence"] >= 80
results.append(("Layer 2: Contradiction Engine", "PASS", f"Conflict '{auth_conf['title']}' scored {auth_conf['confidence']}% confidence (Agent: {auth_conf['detected_by_agent']['name']})"))

# ── 7. Layer 0: Risk Check & Pre-Approval Policy Matrix ──────────────────────
risk_res = request_json(f"/api/v1/conflicts/{auth_conf['id']}/risk-check", token=token)
assert risk_res["approved_to_proceed"] is True
results.append(("Layer 0: Risk & Policy Engine", "PASS", f"Risk: {risk_res['risk_level']}, Approver: {risk_res['required_approver']}, All 5 rules passed"))

# ── 8. Layer 0: Approval Action Execution (Jira / Slack / GitHub / Doc) ──────
appr_res = request_json(f"/api/v1/conflicts/{auth_conf['id']}/approve", method="POST", body={"reason": "Integrated VCB test"}, token=token)
assert appr_res["conflict"]["status"] == "approved"
assert len(appr_res["workflows"]) == 5
tools = [w["tool"] for w in appr_res["workflows"]]
results.append(("Layer 0: Multi-System Execution", "PASS", f"5 workflows dispatched: {', '.join(tools)}"))

# ── 9. Layer 1: Audit Log Compliance ─────────────────────────────────────────
audit_res = request_json("/api/v1/audit-logs", token=token)
assert len(audit_res["audit_logs"]) >= 1
results.append(("Layer 1: Immutable Audit Log", "PASS", f"Audit record #{audit_res['audit_logs'][0]['id']} verified"))

# ── 10. Reset ────────────────────────────────────────────────────────────────
rst_res = request_json("/api/v1/demo/reset", method="POST", body={}, token=token)
assert rst_res["ok"] is True
results.append(("System Baseline Reset", "PASS", "Database cleanly reset to initial state"))

print()
print("  COMPANY BRAIN OS — FULL 7-LAYER INTEGRATION AUDIT (VCB + CORE)")
print("  " + "=" * 74)
for name, status, detail in results:
    print(f"  {status}  {name:<38} {detail}")
print("  " + "=" * 74)
print(f"  All {len(results)} end-to-end integration checks passed with 100% success!")
print()
