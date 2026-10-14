import hashlib
import pytest
from app.models.document import Document
from app.models.event import CompanyEvent
from app.models.conflict import Conflict, ConflictEvidence
from app.models.workflow import WorkflowAction
from app.services.layer2_intelligence.conflict_detector import ConflictDetectorService
from app.services.layer0_execution.action_executor import ActionExecutorService


def test_stage1_partitioned_candidate_retrieval(db, org_a):
    """Stage 1: Query cross-source event pairs with cosine similarity >= 0.75."""
    # 1. Create a GitHub Document
    doc = Document(
        id="doc-gh-spec-01",
        organization_id=org_a.id,
        title="acme-corp/payment-service:README.md",
        content="Production payment gateway architecture requires batch size 32 and port 5432.",
        source="GitHub",
        author="Sarah Engineer",
        owner="Platform Engineering",
        authority_score=0.9,
        freshness_score=0.4,
        timestamp="2026-10-06T10:00:00Z",
    )
    db.add(doc)

    # 2. Create a Slack live event on same topic
    slack_evt = CompanyEvent(
        id="evt-slack-batch-01",
        organization_id=org_a.id,
        provider_event_id="slack_batch_101",
        source="Slack",
        type="message.created",
        title="Slack #dev-huddle",
        content="We updated the prediction model batch size to 64 instead of 32 for performance.",
        author="Sarah Engineer",
        owner="Platform Engineering",
        timestamp="2026-10-06T10:00:00Z",
        authority_score=0.95,
        freshness_score=0.99,
        ingestion_source="slack-poller",
    )
    db.add(slack_evt)
    db.commit()

    # Run Stage 1 retrieval
    candidates = ConflictDetectorService.find_cross_source_candidates(db, org_a.id, threshold=0.70)
    assert len(candidates) >= 1
    matched = next((c for c in candidates if c["item_a"]["id"] == doc.id or c["item_b"]["id"] == doc.id), None)
    assert matched is not None
    assert matched["similarity"] >= 0.70


def test_stage2_contradiction_arbiter_and_git_diff():
    """Stage 2: Contradiction Arbiter classifies factual opposition and generates a unified git diff."""
    candidate = {
        "similarity": 0.88,
        "item_a": {
            "id": "doc-gh-01",
            "type": "document",
            "source": "GitHub",
            "title": "acme-corp/payment-service:README.md",
            "content": "Production payment gateway architecture requires batch size 32.",
            "owner": "Platform Lead",
        },
        "item_b": {
            "id": "evt-slack-01",
            "type": "event",
            "source": "Slack",
            "title": "Slack #engineering",
            "content": "Decision update: We updated the prediction model batch size to 64 instead of 32.",
            "author": "Alice",
        },
    }

    result = ConflictDetectorService.arbitrate_candidate_pair(candidate)
    assert result is not None
    assert result["classification"] == "CONTRADICTORY"
    assert result["severity"] in ["HIGH", "CRITICAL"]
    assert "Batch size" in result["title"] or "Batch Size" in result["title"]

    # Verify unified git diff format
    diff = result["recommended_diff"]
    assert diff is not None
    assert "--- a/" in diff
    assert "+++ b/" in diff
    assert "@@" in diff
    assert "32" in diff
    assert "64" in diff



def test_stage3_deterministic_deduplication_and_persistence(db, org_a):
    """Stage 3: Prevent inbox flooding using SHA-256 pair hashes (dedup_hash) and persist ConflictEvidence."""
    arbitration = {
        "classification": "CONTRADICTORY",
        "severity": "HIGH",
        "title": "Model Batch Size Drift: 32 vs 64",
        "description": "README specifies batch size 32, but Slack decision set it to 64.",
        "old_claim": "Batch size: 32",
        "new_claim": "Batch size: 64",
        "recommended_update": "Update model hyperparameters documentation to specify batch size of 64.",
        "business_impact": "Throughput regressions",
        "target_repo": "acme-corp/payment-service",
        "target_file_path": "README.md",
        "recommended_diff": "--- a/README.md\n+++ b/README.md\n@@ -1,3 +1,3 @@\n-Batch size: 32\n+Batch size: 64\n",
        "item_a": {
            "id": "doc-test-101",
            "type": "document",
            "source": "GitHub",
            "title": "acme-corp/payment-service:README.md",
            "content": "Batch size: 32",
            "owner": "Sarah",
            "authority_score": 0.85,
            "timestamp": "2026-10-01T12:00:00Z",
        },
        "item_b": {
            "id": "evt-test-102",
            "type": "event",
            "source": "Slack",
            "title": "Slack message",
            "content": "Batch size: 64 instead of 32",
            "author": "Priya",
            "authority_score": 0.95,
            "timestamp": "2026-10-06T10:00:00Z",
        },
    }

    # First persistence
    conflict_1 = ConflictDetectorService.persist_detected_conflict(db, arbitration, org_a.id)
    assert conflict_1 is not None
    assert conflict_1.status.upper() == "OPEN"
    assert conflict_1.dedup_hash is not None

    # Expected SHA-256 hash
    expected_hash = hashlib.sha256(b"doc-test-101:evt-test-102").hexdigest()
    assert conflict_1.dedup_hash == expected_hash

    # Verify ConflictEvidence records
    evidences = db.query(ConflictEvidence).filter(ConflictEvidence.conflict_id == conflict_1.id).all()
    assert len(evidences) == 2
    sources = {ev.source for ev in evidences}
    assert "GitHub" in sources
    assert "Slack" in sources

    # Second persistence with same pair -> MUST deduplicate and return exact same Conflict
    conflict_2 = ConflictDetectorService.persist_detected_conflict(db, arbitration, org_a.id)
    assert conflict_2.id == conflict_1.id

    # Count of conflicts in DB with this dedup_hash must remain 1 (no inbox flooding)
    count = db.query(Conflict).filter(Conflict.dedup_hash == expected_hash).count()
    assert count == 1


def test_stage4_closed_loop_layer0_remediation(client_a_owner, db, org_a):
    """Stage 4: POST /api/v1/conflicts/{id}/approve automatically creates branch axiom/fix-docs-<id> and opens PR."""
    diff = "--- a/README.md\n+++ b/README.md\n@@ -10,3 +10,3 @@\n-Batch size: 32\n+Batch size: 64\n"
    conflict = Conflict(
        id="c-remediation-test-01",
        organization_id=org_a.id,
        title="Batch Size Contradiction",
        description="Discrepancy between Slack decision and GitHub README",
        severity="HIGH",
        status="OPEN",
        target_repo="acme-corp/payment-service",
        target_file_path="README.md",
        recommended_diff=diff,
        domain="Platform Engineering",
        old_claim="Batch size: 32",
        new_claim="Batch size: 64",
        recommended_update="Update batch size to 64 in README.md",
        business_impact="Throughput regression",
        owner="Platform Engineering Lead",
    )
    db.add(conflict)
    db.commit()

    # Call approve endpoint
    resp = client_a_owner.post(f"/api/v1/conflicts/{conflict.id}/approve", json={"reason": "Approved by Architecture Lead"})
    assert resp.status_code == 200
    data = resp.json()

    assert data["conflict"]["status"].upper() in ["APPROVED", "RESOLVED"]
    assert "workflows" in data

    # Verify GitHub Workflow action created
    gh_wf = next((w for w in data["workflows"] if w["tool"] == "GitHub"), None)
    assert gh_wf is not None
    assert f"axiom/fix-docs-{conflict.id}" in gh_wf["title"] or f"axiom/fix-docs-{conflict.id}" in gh_wf["description"]
    assert "https://github.com/acme-corp/payment-service/pull/" in gh_wf["description"]

    # Verify DB persistence of resolved state
    db.refresh(conflict)
    assert conflict.status.upper() in ["APPROVED", "RESOLVED"]
    assert conflict.resolved_by is not None
    assert conflict.resolved_at is not None
