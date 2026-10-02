from datetime import datetime, timezone
import pytest
from sqlalchemy.exc import IntegrityError
from app.models.organization import Organization
from app.models.audit import AuditLog
from app.models.user import User, UserRole
from app.services.tenant_repository import TenantScopedRepository
from app.auth.service import AuthService


def test_audit_logs_restrict_hard_deletion(db, org_a):
    """
    Confirms an organization with existing audit log rows cannot be hard-deleted
    due to ondelete='RESTRICT' at the database/foreign-key level [REV2].
    """
    org_id = org_a.id

    # Create audit log entry for org_a
    repo_a = TenantScopedRepository(db, org_id, "usr-alice", "Alice")
    repo_a.log_audit(
        action="compliance.retention_test",
        title="Compliance Test Audit Record",
        target=org_id,
        reason="Preserve audit trail",
    )

    # Attempt to delete Organization directly - must fail due to foreign key RESTRICT constraint
    with pytest.raises((IntegrityError, Exception)) as exc_info:
        org = db.query(Organization).filter(Organization.id == org_id).first()
        db.delete(org)
        db.flush()

    assert "FOREIGN KEY" in str(exc_info.value).upper() or "RESTRICT" in str(exc_info.value).upper() or isinstance(exc_info.value, IntegrityError)


def test_soft_delete_deactivated_at_blocks_login(db, org_a, user_a_owner, unauth_client):
    """
    Confirms setting deactivated_at blocks authentication while preserving rows [REV2].
    """
    # 1. User can login while active
    active_login = AuthService.authenticate_user(db, user_a_owner.email, "Password123!")
    assert active_login is not None

    # 2. Deactivate organization (soft-delete)
    org_a.deactivated_at = datetime.now(timezone.utc)
    db.commit()

    # 3. Login attempt now fails
    deactivated_login = AuthService.authenticate_user(db, user_a_owner.email, "Password123!")
    assert deactivated_login is None

    # 4. API login endpoint returns 401
    resp = unauth_client.post(
        "/api/v1/auth/login",
        json={"email": user_a_owner.email, "password": "Password123!"},
    )
    assert resp.status_code == 401

    # 5. Verify all data still exists in DB
    user_in_db = db.query(User).filter(User.id == user_a_owner.id).first()
    assert user_in_db is not None
    assert user_in_db.organization.deactivated_at is not None
