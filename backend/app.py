from __future__ import annotations

import json
import os
from copy import deepcopy
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
FRONTEND_DIR = ROOT / "frontend"


def load_json(name: str) -> list[dict[str, Any]]:
    with (DATA_DIR / name).open("r", encoding="utf-8") as file:
        return json.load(file)


INITIAL_STATE = {
    "documents": load_json("documents.json"),
    "events": load_json("events.json"),
    "conflicts": load_json("conflicts.json"),
    "workflows": [],
    "audit_logs": [],
}

STATE = deepcopy(INITIAL_STATE)


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def find_by_id(items: list[dict[str, Any]], item_id: str) -> dict[str, Any] | None:
    return next((item for item in items if item["id"] == item_id), None)


def severity_weight(severity: str) -> float:
    return {"critical": 1.0, "high": 0.82, "medium": 0.62, "low": 0.42}.get(severity, 0.5)


def calculate_confidence(conflict: dict[str, Any]) -> int:
    document = find_by_id(STATE["documents"], conflict["document_id"])
    evidence = [
        find_by_id(STATE["events"], evidence_id)
        for evidence_id in conflict.get("evidence_ids", [])
    ]
    evidence = [item for item in evidence if item]

    if not document or not evidence:
        return 50

    avg_evidence_authority = sum(item["authority_score"] for item in evidence) / len(evidence)
    avg_evidence_freshness = sum(item["freshness_score"] for item in evidence) / len(evidence)
    stale_gap = max(0.0, avg_evidence_freshness - document["freshness_score"])
    score = (
        avg_evidence_authority * 0.36
        + avg_evidence_freshness * 0.34
        + stale_gap * 0.18
        + severity_weight(conflict["severity"]) * 0.12
    )
    return min(99, max(55, round(score * 100)))


def enrich_conflict(conflict: dict[str, Any]) -> dict[str, Any]:
    document = find_by_id(STATE["documents"], conflict["document_id"])
    evidence = [
        find_by_id(STATE["events"], evidence_id)
        for evidence_id in conflict.get("evidence_ids", [])
    ]
    evidence = [item for item in evidence if item]

    return {
        **conflict,
        "document": document,
        "evidence": evidence,
        "confidence": calculate_confidence(conflict),
        "reasoning": (
            "Newer high-authority operational evidence contradicts the official document. "
            "The safest action is to route an AI-generated update to the responsible owner "
            "for approval before changing company knowledge."
        ),
    }


def knowledge_health() -> dict[str, Any]:
    documents = STATE["documents"]
    conflicts = STATE["conflicts"]
    open_conflicts = [item for item in conflicts if item["status"] == "open"]
    resolved_conflicts = [item for item in conflicts if item["status"] in {"approved", "resolved"}]
    stale_docs = [item for item in documents if item.get("status") != "healthy"]
    avg_freshness = round(
        sum(item["freshness_score"] for item in documents) / max(len(documents), 1) * 100
    )
    health_score = max(0, min(100, round(avg_freshness - len(open_conflicts) * 7 + len(resolved_conflicts) * 4)))

    return {
        "knowledge_health": health_score,
        "total_documents": len(documents),
        "total_events": len(STATE["events"]),
        "open_conflicts": len(open_conflicts),
        "resolved_conflicts": len(resolved_conflicts),
        "stale_documents": len(stale_docs),
        "automated_workflows": len(STATE["workflows"]),
        "last_scan": now_iso(),
    }


def create_workflow(conflict: dict[str, Any], action: str) -> list[dict[str, Any]]:
    if action != "approve":
        return []

    created_at = now_iso()
    actions = [
        {
            "id": f"wf-{conflict['id']}-doc",
            "conflict_id": conflict["id"],
            "tool": "Knowledge Base",
            "title": "Documentation update prepared",
            "description": conflict["recommended_update"],
            "status": "completed",
            "created_at": created_at,
        },
        {
            "id": f"wf-{conflict['id']}-jira",
            "conflict_id": conflict["id"],
            "tool": "Jira",
            "title": f"Task created for {conflict['owner']}",
            "description": f"Review and operationalize: {conflict['title']}",
            "status": "completed",
            "created_at": created_at,
        },
        {
            "id": f"wf-{conflict['id']}-slack",
            "conflict_id": conflict["id"],
            "tool": "Slack",
            "title": "Owner notified",
            "description": f"{conflict['owner']} was notified with evidence and recommended next steps.",
            "status": "completed",
            "created_at": created_at,
        },
        {
            "id": f"wf-{conflict['id']}-github",
            "conflict_id": conflict["id"],
            "tool": "GitHub",
            "title": "Documentation PR drafted",
            "description": "A simulated documentation pull request was generated for audit-friendly review.",
            "status": "completed",
            "created_at": created_at,
        },
    ]
    STATE["workflows"].extend(actions)
    return actions


def log_audit(conflict: dict[str, Any], action: str, reason: str = "") -> dict[str, Any]:
    entry = {
        "id": f"audit-{len(STATE['audit_logs']) + 1}",
        "conflict_id": conflict["id"],
        "actor": "Hackathon Demo Admin",
        "action": action,
        "title": conflict["title"],
        "reason": reason,
        "timestamp": now_iso(),
        "evidence_count": len(conflict.get("evidence_ids", [])),
    }
    STATE["audit_logs"].insert(0, entry)
    return entry


def apply_approval(conflict_id: str, action: str, reason: str = "") -> tuple[int, dict[str, Any]]:
    conflict = find_by_id(STATE["conflicts"], conflict_id)
    if not conflict:
        return 404, {"error": "Conflict not found"}

    if action == "approve":
        conflict["status"] = "approved"
        document = find_by_id(STATE["documents"], conflict["document_id"])
        if document:
            document["content"] = conflict["recommended_update"]
            document["freshness_score"] = 0.97
            document["status"] = "healthy"
        workflows = create_workflow(conflict, action)
        audit = log_audit(conflict, "approved", reason)
        return 200, {"conflict": enrich_conflict(conflict), "workflows": workflows, "audit": audit}

    if action == "reject":
        conflict["status"] = "rejected"
        audit = log_audit(conflict, "rejected", reason)
        return 200, {"conflict": enrich_conflict(conflict), "workflows": [], "audit": audit}

    return 400, {"error": "Unsupported action"}


class CompanyBrainHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        parsed = urlparse(path)
        clean_path = parsed.path
        if clean_path == "/":
            return str(FRONTEND_DIR / "index.html")
        if clean_path.startswith("/api/"):
            return str(FRONTEND_DIR / "index.html")
        return str(FRONTEND_DIR / clean_path.lstrip("/"))

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def send_json(self, status: int, payload: Any) -> None:
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw or "{}")

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/health":
            return self.send_json(200, {"status": "ok", "service": "Company Brain OS"})
        if path == "/api/sources":
            sources = sorted({item["source"] for item in STATE["documents"] + STATE["events"]})
            return self.send_json(200, {"sources": sources})
        if path == "/api/documents":
            return self.send_json(200, {"documents": STATE["documents"]})
        if path == "/api/events":
            return self.send_json(200, {"events": STATE["events"]})
        if path == "/api/knowledge/health":
            return self.send_json(200, knowledge_health())
        if path == "/api/conflicts":
            query = parse_qs(parsed.query)
            status_filter = query.get("status", [None])[0]
            conflicts = [enrich_conflict(item) for item in STATE["conflicts"]]
            if status_filter:
                conflicts = [item for item in conflicts if item["status"] == status_filter]
            return self.send_json(200, {"conflicts": conflicts})
        if path.startswith("/api/conflicts/"):
            conflict_id = path.removeprefix("/api/conflicts/")
            conflict = find_by_id(STATE["conflicts"], conflict_id)
            if not conflict:
                return self.send_json(404, {"error": "Conflict not found"})
            return self.send_json(200, {"conflict": enrich_conflict(conflict)})
        if path == "/api/workflows":
            return self.send_json(200, {"workflows": STATE["workflows"]})
        if path == "/api/audit-logs":
            return self.send_json(200, {"audit_logs": STATE["audit_logs"]})

        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        body = self.read_json_body()

        if path == "/api/demo/reset":
            STATE.clear()
            STATE.update(deepcopy(INITIAL_STATE))
            return self.send_json(200, {"ok": True, "message": "Demo state reset"})

        if path.startswith("/api/conflicts/") and path.endswith("/approve"):
            conflict_id = path.removeprefix("/api/conflicts/").removesuffix("/approve").strip("/")
            status, payload = apply_approval(conflict_id, "approve", body.get("reason", ""))
            return self.send_json(status, payload)

        if path.startswith("/api/conflicts/") and path.endswith("/reject"):
            conflict_id = path.removeprefix("/api/conflicts/").removesuffix("/reject").strip("/")
            status, payload = apply_approval(conflict_id, "reject", body.get("reason", ""))
            return self.send_json(status, payload)

        return self.send_json(404, {"error": "Endpoint not found"})


def main() -> None:
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer((host, port), CompanyBrainHandler)
    print(f"Company Brain OS running at http://{host}:{port}")
    print("Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
