from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import app  # noqa: E402


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    app.STATE.clear()
    app.STATE.update(app.deepcopy(app.INITIAL_STATE))

    health = app.knowledge_health()
    require(health["open_conflicts"] == 3, "Expected three open demo conflicts")
    require(health["stale_documents"] >= 3, "Expected stale or review-required documents")

    conflicts = [app.enrich_conflict(item) for item in app.STATE["conflicts"]]
    primary = next(item for item in conflicts if item["id"] == "conflict-auth-method")
    require(primary["confidence"] >= 80, "Primary conflict should have strong confidence")
    require("OAuth2" in primary["recommended_update"], "Primary recommendation should mention OAuth2")

    status, result = app.apply_approval("conflict-auth-method", "approve")
    require(status == 200, "Approval should succeed")
    require(result["conflict"]["status"] == "approved", "Conflict should be approved")
    require(len(result["workflows"]) == 4, "Approval should create four workflow actions")
    require(len(app.STATE["audit_logs"]) == 1, "Approval should create one audit log")

    payment_doc = app.find_by_id(app.STATE["documents"], "doc-payment-architecture")
    require(payment_doc is not None, "Payment document should exist")
    require(payment_doc["status"] == "healthy", "Approved document should become healthy")

    print(
        json.dumps(
            {
                "status": "ok",
                "health_before_approval": health,
                "approved_conflict": result["conflict"]["id"],
                "workflow_actions": len(result["workflows"]),
                "audit_logs": len(app.STATE["audit_logs"]),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
