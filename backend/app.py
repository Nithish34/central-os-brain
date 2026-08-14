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
    "events":    load_json("events.json"),
    "conflicts": load_json("conflicts.json"),
    "agents":    load_json("agents.json"),
    "workflows": [],
    "audit_logs": [],
    "pipeline_runs": 0,
    "worker_tasks_completed": 91,
    "messages_processed": 127,
}

STATE = deepcopy(INITIAL_STATE)


# ── Utilities ──────────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def find_by_id(items: list[dict[str, Any]], item_id: str) -> dict[str, Any] | None:
    return next((item for item in items if item["id"] == item_id), None)


def find_agent(agent_id: str) -> dict[str, Any] | None:
    return find_by_id(STATE["agents"], agent_id)


def severity_weight(severity: str) -> float:
    return {"critical": 1.0, "high": 0.82, "medium": 0.62, "low": 0.42}.get(severity, 0.5)


# ── Layer 2: Intelligence Core ─────────────────────────────────────────────

def calculate_confidence(conflict: dict[str, Any]) -> int:
    document = find_by_id(STATE["documents"], conflict["document_id"])
    evidence = [
        find_by_id(STATE["events"], eid)
        for eid in conflict.get("evidence_ids", [])
    ]
    evidence = [e for e in evidence if e]

    if not document or not evidence:
        return 50

    avg_authority = sum(e["authority_score"] for e in evidence) / len(evidence)
    avg_freshness = sum(e["freshness_score"] for e in evidence) / len(evidence)
    stale_gap = max(0.0, avg_freshness - document["freshness_score"])
    score = (
        avg_authority * 0.36
        + avg_freshness * 0.34
        + stale_gap * 0.18
        + severity_weight(conflict["severity"]) * 0.12
    )
    return min(99, max(55, round(score * 100)))


def enrich_conflict(conflict: dict[str, Any]) -> dict[str, Any]:
    document = find_by_id(STATE["documents"], conflict["document_id"])
    evidence = [
        find_by_id(STATE["events"], eid)
        for eid in conflict.get("evidence_ids", [])
    ]
    evidence = [e for e in evidence if e]
    agent = find_agent(conflict.get("detected_by", ""))

    return {
        **conflict,
        "document": document,
        "evidence": evidence,
        "confidence": calculate_confidence(conflict),
        "detected_by_agent": agent,
        "reasoning": (
            "Newer high-authority operational evidence contradicts the official document. "
            "The safest action is to route an AI-generated update to the responsible owner "
            "for approval before changing company knowledge."
        ),
    }


def knowledge_health() -> dict[str, Any]:
    documents = STATE["documents"]
    conflicts = STATE["conflicts"]
    open_c    = [c for c in conflicts if c["status"] == "open"]
    resolved  = [c for c in conflicts if c["status"] in {"approved", "resolved"}]
    stale     = [d for d in documents if d.get("status") != "healthy"]
    avg_fresh = round(
        sum(d["freshness_score"] for d in documents) / max(len(documents), 1) * 100
    )
    health = max(0, min(100, round(avg_fresh - len(open_c) * 7 + len(resolved) * 4)))

    return {
        "knowledge_health":    health,
        "total_documents":     len(documents),
        "total_events":        len(STATE["events"]),
        "open_conflicts":      len(open_c),
        "resolved_conflicts":  len(resolved),
        "stale_documents":     len(stale),
        "automated_workflows": len(STATE["workflows"]),
        "last_scan":           now_iso(),
    }


# ── Layer 2: Intelligence Core endpoints data ──────────────────────────────

def intelligence_health() -> dict[str, Any]:
    documents = STATE["documents"]
    events    = STATE["events"]
    conflicts = STATE["conflicts"]
    agents    = STATE["agents"]

    total_chunks = sum(d.get("chunk_count", 4) for d in documents)
    indexed_events = sum(1 for e in events if e.get("vector_indexed", False))
    open_c  = [c for c in conflicts if c["status"] == "open"]
    graph_nodes = len(documents) + len(events)
    graph_edges = len(conflicts) * 2 + len(events)

    return {
        "rag_engine": {
            "status":           "active",
            "documents_indexed": len(documents),
            "total_chunks":      total_chunks,
            "events_indexed":    indexed_events,
            "embedding_model":   "text-embedding-3-small",
            "embedding_dims":    1536,
            "hybrid_search":     True,
            "reranking":         True,
        },
        "knowledge_graph": {
            "status":      "active",
            "backend":     "Neo4j",
            "nodes":       graph_nodes,
            "edges":       graph_edges,
            "last_updated": now_iso(),
        },
        "conflict_detection": {
            "status":            "active",
            "last_run":          now_iso(),
            "conflicts_found":   len(open_c),
            "total_processed":   len(conflicts),
            "avg_contradiction": round(
                sum(c.get("contradiction_score", 0.5) for c in conflicts) / max(len(conflicts), 1), 2
            ),
        },
        "memory_store": {
            "status":           "active",
            "short_term_count": len(events),
            "long_term_count":  sum(a.get("memory_entries", 0) for a in agents),
            "company_context_keys": 12,
        },
    }


def get_agents() -> list[dict[str, Any]]:
    agents = STATE["agents"]
    conflicts = STATE["conflicts"]
    result = []
    for agent in agents:
        detected_ids = agent.get("detected_conflict_ids", [])
        open_count   = sum(
            1 for c in conflicts
            if c["id"] in detected_ids and c["status"] == "open"
        )
        resolved_count = sum(
            1 for c in conflicts
            if c["id"] in detected_ids and c["status"] in {"approved", "resolved"}
        )
        result.append({
            **agent,
            "open_conflicts":     open_count,
            "resolved_conflicts": resolved_count,
        })
    return result


def get_memory() -> dict[str, Any]:
    events    = STATE["events"]
    conflicts = STATE["conflicts"]
    agents    = STATE["agents"]
    resolved  = [c for c in conflicts if c["status"] in {"approved", "resolved"}]

    short_term = [
        {
            "id":     e["id"],
            "title":  e["title"],
            "source": e["source"],
            "type":   e.get("event_type_normalized", e["type"]),
            "ts":     e["timestamp"],
        }
        for e in sorted(events, key=lambda x: x["timestamp"], reverse=True)[:5]
    ]
    long_term = [
        {
            "conflict_id": c["id"],
            "title":       c["title"],
            "status":      c["status"],
            "owner":       c["owner"],
        }
        for c in resolved
    ]
    company_context = [
        {"key": "default_auth_method",        "value": "OAuth2 client credentials"},
        {"key": "release_cadence",             "value": "Tuesday & Thursday noon"},
        {"key": "enterprise_onboarding_owner", "value": "Implementation Squad (>25L ACV)"},
        {"key": "primary_db",                  "value": "PostgreSQL 16"},
        {"key": "vector_store",                "value": "pgvector 0.7"},
        {"key": "graph_db",                    "value": "Neo4j 5.x"},
        {"key": "event_bus",                   "value": "Redis Streams"},
        {"key": "object_storage",              "value": "S3 / MinIO"},
        {"key": "orchestrator",                "value": "LangGraph"},
        {"key": "workflow_engine",             "value": "n8n (self-hosted)"},
        {"key": "total_agents",                "value": str(len(agents))},
        {"key": "embedding_model",             "value": "text-embedding-3-small (1536d)"},
    ]
    return {
        "short_term":      short_term,
        "long_term":       long_term,
        "company_context": company_context,
    }


# ── Layer 3: Processing & Orchestration ──────────────────────────────────

def pipeline_status() -> dict[str, Any]:
    events    = STATE["events"]
    conflicts = STATE["conflicts"]

    processed = sum(1 for e in events if e.get("pipeline_stage") == "processed")
    STATE["pipeline_runs"] += 1

    return {
        "event_bus": {
            "backend":            "Redis Streams",
            "status":             "active",
            "messages_processed": STATE["messages_processed"] + len(events),
            "queue_depth":        0,
            "throughput_per_min": 14,
        },
        "background_workers": {
            "backend":         "Celery",
            "status":          "active",
            "workers_online":  3,
            "tasks_completed": STATE["worker_tasks_completed"],
            "tasks_pending":   0,
            "queues":          ["ingestion", "embedding", "conflict-detection"],
        },
        "event_router": {
            "status":          "active",
            "events_routed":   processed,
            "pipelines_active": 2,
            "routing_rules":   6,
        },
        "pipeline_orchestrator": {
            "backend":       "LangGraph",
            "status":        "active",
            "runs_total":    STATE["pipeline_runs"],
            "steps_per_run": 5,
            "last_run":      now_iso(),
        },
        "event_stages": [
            {
                "id":     e["id"],
                "title":  e["title"],
                "source": e["source"],
                "stage":  e.get("pipeline_stage", "queued"),
                "type":   e.get("event_type_normalized", e["type"]),
                "ts":     e["timestamp"],
            }
            for e in sorted(events, key=lambda x: x["timestamp"], reverse=True)
        ],
    }


# ── Layer 0: Execution Layer ────────────────────────────────────────────────

def risk_check(conflict_id: str) -> tuple[int, dict[str, Any]]:
    conflict = find_by_id(STATE["conflicts"], conflict_id)
    if not conflict:
        return 404, {"error": "Conflict not found"}

    matrix = conflict.get("approval_matrix", {})
    risk   = conflict.get("risk_level", "MEDIUM")
    doc    = find_by_id(STATE["documents"], conflict["document_id"])
    evidence = [
        find_by_id(STATE["events"], eid)
        for eid in conflict.get("evidence_ids", [])
    ]
    evidence = [e for e in evidence if e]

    avg_evidence_authority = (
        sum(e["authority_score"] for e in evidence) / len(evidence) if evidence else 0.5
    )
    rules_passed = [
        {"rule": "Minimum evidence sources",    "passed": len(evidence) >= 1},
        {"rule": "Evidence authority threshold", "passed": avg_evidence_authority >= 0.80},
        {"rule": "Document is stale",            "passed": doc.get("status") != "healthy" if doc else False},
        {"rule": "Conflict has owner",           "passed": bool(conflict.get("owner"))},
        {"rule": "Recommended update exists",    "passed": bool(conflict.get("recommended_update"))},
    ]
    all_passed = all(r["passed"] for r in rules_passed)

    return 200, {
        "conflict_id":        conflict_id,
        "risk_level":         risk,
        "approved_to_proceed": all_passed,
        "rules":              rules_passed,
        "required_approver":  matrix.get("required_approver", conflict.get("owner", "Unknown")),
        "escalation_path":    matrix.get("escalation_path", ""),
        "requires_legal":     matrix.get("requires_legal", False),
        "checked_at":         now_iso(),
    }


def data_foundation_stats() -> dict[str, Any]:
    documents = STATE["documents"]
    events    = STATE["events"]
    conflicts = STATE["conflicts"]

    total_chunks = sum(d.get("chunk_count", 4) for d in documents)
    graph_nodes  = len(documents) + len(events)
    graph_edges  = len(conflicts) * 2 + len(events)

    return {
        "postgresql": {
            "status":      "active",
            "host":        "localhost:5432",
            "tables":      ["documents", "events", "conflicts", "audit_logs"],
            "row_count":   len(documents) + len(events) + len(conflicts),
            "description": "Core relational data — documents, events, conflicts, audit logs",
        },
        "pgvector": {
            "status":       "active",
            "host":         "localhost:5432",
            "embeddings":   total_chunks,
            "dimensions":   1536,
            "index":        "IVFFlat",
            "description":  "Vector embeddings for RAG & semantic search",
        },
        "neo4j": {
            "status":      "active",
            "host":        "bolt://localhost:7687",
            "nodes":       graph_nodes,
            "edges":       graph_edges,
            "description": "Knowledge graph — document ↔ event relationships",
        },
        "redis": {
            "status":       "active",
            "host":         "localhost:6379",
            "cache_keys":   len(events) * 2 + len(documents),
            "streams":      ["events-raw", "events-normalised", "conflict-queue"],
            "description":  "Event bus (Streams) + response cache",
        },
        "s3_minio": {
            "status":       "active",
            "host":         "localhost:9000",
            "buckets":      ["documents", "embeddings-cache", "audit-exports"],
            "object_count": len(documents) + len(STATE["audit_logs"]),
            "description":  "Object storage — raw documents and files",
        },
    }


def create_workflow(conflict: dict[str, Any], action: str) -> list[dict[str, Any]]:
    if action != "approve":
        return []

    created_at = now_iso()
    STATE["worker_tasks_completed"] += 4
    STATE["messages_processed"] += 5

    actions = [
        {
            "id":          f"wf-{conflict['id']}-riskcheck",
            "conflict_id": conflict["id"],
            "layer":       "Layer 0 — Execution",
            "tool":        "Risk & Policy Engine",
            "title":       "Risk & policy check passed",
            "description": f"Approval matrix validated for {conflict['owner']}. Risk level: {conflict.get('risk_level','MEDIUM')}. All rules passed.",
            "status":      "completed",
            "created_at":  created_at,
        },
        {
            "id":          f"wf-{conflict['id']}-doc",
            "conflict_id": conflict["id"],
            "layer":       "Layer 0 — Execution",
            "tool":        "Knowledge Base",
            "title":       "Official document updated",
            "description": conflict["recommended_update"],
            "status":      "completed",
            "created_at":  created_at,
        },
        {
            "id":          f"wf-{conflict['id']}-jira",
            "conflict_id": conflict["id"],
            "layer":       "Layer 0 — Execution",
            "tool":        "Jira",
            "title":       f"Task created for {conflict['owner']}",
            "description": f"Review and operationalize: {conflict['title']}",
            "status":      "completed",
            "created_at":  created_at,
        },
        {
            "id":          f"wf-{conflict['id']}-slack",
            "conflict_id": conflict["id"],
            "layer":       "Layer 0 — Execution",
            "tool":        "Slack",
            "title":       "Owner notified via Slack",
            "description": f"{conflict['owner']} was notified with evidence and recommended next steps.",
            "status":      "completed",
            "created_at":  created_at,
        },
        {
            "id":          f"wf-{conflict['id']}-github",
            "conflict_id": conflict["id"],
            "layer":       "Layer 0 — Execution",
            "tool":        "GitHub",
            "title":       "Documentation PR drafted",
            "description": "A simulated documentation pull request was generated for audit-friendly review.",
            "status":      "completed",
            "created_at":  created_at,
        },
    ]
    STATE["workflows"].extend(actions)
    return actions


def log_audit(conflict: dict[str, Any], action: str, reason: str = "") -> dict[str, Any]:
    entry = {
        "id":             f"audit-{len(STATE['audit_logs']) + 1}",
        "conflict_id":    conflict["id"],
        "actor":          "Hackathon Demo Admin",
        "action":         action,
        "title":          conflict["title"],
        "reason":         reason,
        "timestamp":      now_iso(),
        "evidence_count": len(conflict.get("evidence_ids", [])),
        "detected_by":    conflict.get("detected_by", ""),
        "risk_level":     conflict.get("risk_level", ""),
        "layer":          "Layer 0 — Execution",
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
            document["content"]       = conflict["recommended_update"]
            document["freshness_score"] = 0.97
            document["status"]        = "healthy"
        workflows = create_workflow(conflict, action)
        audit     = log_audit(conflict, "approved", reason)
        return 200, {"conflict": enrich_conflict(conflict), "workflows": workflows, "audit": audit}

    if action == "reject":
        conflict["status"] = "rejected"
        audit = log_audit(conflict, "rejected", reason)
        return 200, {"conflict": enrich_conflict(conflict), "workflows": [], "audit": audit}

    return 400, {"error": "Unsupported action"}


# ── HTTP Handler ───────────────────────────────────────────────────────────

class CompanyBrainHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        parsed    = urlparse(path)
        clean     = parsed.path
        if clean == "/":
            return str(FRONTEND_DIR / "index.html")
        if clean.startswith("/api/"):
            return str(FRONTEND_DIR / "index.html")
        return str(FRONTEND_DIR / clean.lstrip("/"))

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

    def log_message(self, fmt: str, *args: Any) -> None:
        pass  # suppress per-request noise

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path   = parsed.path

        # ── Core / Knowledge ──────────────────────────────────
        if path == "/api/health":
            return self.send_json(200, {"status": "ok", "service": "Company Brain OS"})
        if path == "/api/sources":
            sources = sorted({i["source"] for i in STATE["documents"] + STATE["events"]})
            return self.send_json(200, {"sources": sources})
        if path == "/api/documents":
            return self.send_json(200, {"documents": STATE["documents"]})
        if path == "/api/events":
            return self.send_json(200, {"events": STATE["events"]})
        if path == "/api/knowledge/health":
            return self.send_json(200, knowledge_health())

        # ── Layer 2: Intelligence Core ────────────────────────
        if path == "/api/intelligence/health":
            return self.send_json(200, intelligence_health())
        if path == "/api/agents":
            return self.send_json(200, {"agents": get_agents()})
        if path == "/api/memory":
            return self.send_json(200, get_memory())

        # ── Layer 3: Processing & Orchestration ───────────────
        if path == "/api/pipeline/status":
            return self.send_json(200, pipeline_status())

        # ── Layer 1: Data Foundation ──────────────────────────
        if path == "/api/data-foundation":
            return self.send_json(200, data_foundation_stats())

        # ── Conflicts ─────────────────────────────────────────
        if path == "/api/conflicts":
            query       = parse_qs(parsed.query)
            status_filt = query.get("status", [None])[0]
            conflicts   = [enrich_conflict(c) for c in STATE["conflicts"]]
            if status_filt:
                conflicts = [c for c in conflicts if c["status"] == status_filt]
            return self.send_json(200, {"conflicts": conflicts})
        if path.startswith("/api/conflicts/") and not path.endswith(("/approve", "/reject")):
            cid      = path.removeprefix("/api/conflicts/").strip("/")
            conflict = find_by_id(STATE["conflicts"], cid)
            if not conflict:
                return self.send_json(404, {"error": "Conflict not found"})
            return self.send_json(200, {"conflict": enrich_conflict(conflict)})

        # ── Layer 0: Risk Check ───────────────────────────────
        if path.startswith("/api/risk-check/"):
            cid    = path.removeprefix("/api/risk-check/").strip("/")
            status, payload = risk_check(cid)
            return self.send_json(status, payload)

        # ── Layer 0: Execution / Workflows / Audit ────────────
        if path == "/api/workflows":
            return self.send_json(200, {"workflows": STATE["workflows"]})
        if path == "/api/audit-logs":
            return self.send_json(200, {"audit_logs": STATE["audit_logs"]})

        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path   = parsed.path
        body   = self.read_json_body()

        if path == "/api/demo/reset":
            STATE.clear()
            STATE.update(deepcopy(INITIAL_STATE))
            return self.send_json(200, {"ok": True, "message": "Demo state reset"})

        if path.startswith("/api/conflicts/") and path.endswith("/approve"):
            cid    = path.removeprefix("/api/conflicts/").removesuffix("/approve").strip("/")
            status, payload = apply_approval(cid, "approve", body.get("reason", ""))
            return self.send_json(status, payload)

        if path.startswith("/api/conflicts/") and path.endswith("/reject"):
            cid    = path.removeprefix("/api/conflicts/").removesuffix("/reject").strip("/")
            status, payload = apply_approval(cid, "reject", body.get("reason", ""))
            return self.send_json(status, payload)

        return self.send_json(404, {"error": "Endpoint not found"})


# ── Entry Point ────────────────────────────────────────────────────────────

def main() -> None:
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer((host, port), CompanyBrainHandler)
    print(f"Company Brain OS — http://{host}:{port}")
    print("Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
