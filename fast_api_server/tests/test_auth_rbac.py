import pytest
from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.models.user import User, UserRole


def test_argon2_password_hashing():
    raw_pass = "SuperSecurePassword2026!"
    hashed = hash_password(raw_pass)
    assert hashed.startswith("$argon2")
    assert verify_password(raw_pass, hashed)
    assert not verify_password("WrongPassword", hashed)


def test_registration_and_cookie_auth(unauth_client, db):
    payload = {
        "email": "newowner@enterprise.example.com",
        "password": "StrongPassword123!",
        "full_name": "New Enterprise Owner",
        "organization_name": "Enterprise Holdings Inc",
    }
    resp = unauth_client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["user"]["email"] == "newowner@enterprise.example.com"
    assert data["user"]["role"] == "owner"
    assert "csrf_token" in data

    # Verify httpOnly cookie was set
    assert settings.JWT_COOKIE_NAME in resp.cookies
    assert settings.CSRF_COOKIE_NAME in resp.cookies


def test_login_flow(unauth_client, user_a_owner):
    resp = unauth_client.post(
        "/api/v1/auth/login",
        json={"email": user_a_owner.email, "password": "Password123!"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["id"] == user_a_owner.id
    assert settings.JWT_COOKIE_NAME in resp.cookies


def test_csrf_middleware_protection(client_a_owner):
    # Valid CSRF header succeeds
    valid_resp = client_a_owner.post("/api/v1/auth/logout")
    assert valid_resp.status_code == 200

    # Removing CSRF header on state-changing request with cookie auth fails with 403
    client_a_owner.headers.pop(settings.CSRF_HEADER_NAME, None)
    invalid_resp = client_a_owner.post("/api/v1/conflicts/dummy/approve", json={"reason": "test"})
    assert invalid_resp.status_code == 403
    assert "CSRF validation failed" in invalid_resp.json()["detail"]


def test_rbac_role_hierarchy(client_a_employee, client_a_admin, user_a_employee):
    # Employee cannot update user roles
    emp_role_update = client_a_employee.patch(
        f"/api/v1/auth/users/{user_a_employee.id}/role",
        json={"role": "manager"},
    )
    assert emp_role_update.status_code == 403

    # Admin CAN update user roles
    admin_role_update = client_a_admin.patch(
        f"/api/v1/auth/users/{user_a_employee.id}/role",
        json={"role": "manager"},
    )
    assert admin_role_update.status_code == 200
    assert admin_role_update.json()["role"] == "manager"


def test_google_oauth_authorize(unauth_client):
    resp = unauth_client.get("/api/v1/auth/oauth/google/authorize")
    assert resp.status_code == 200
    data = resp.json()
    assert "authorization_url" in data
    assert "accounts.google.com" in data["authorization_url"]
    assert "state" in data


def test_google_id_token_verification(unauth_client):
    resp = unauth_client.post(
        "/api/v1/auth/oauth/google/verify",
        json={"credential": "mock_alex_google_engineer@google.example.com"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "user" in data
    assert "access_token" in data
    assert data["access_token"] is not None
    assert data["user"]["email"] == "alex_google_engineer@google.example.com"
    assert settings.JWT_COOKIE_NAME in resp.cookies
    assert settings.CSRF_COOKIE_NAME in resp.cookies


def test_google_login_redirect(unauth_client):
    resp = unauth_client.get("/api/v1/auth/google/login", follow_redirects=False)
    assert resp.status_code == 307
    location = resp.headers["location"]
    assert "accounts.google.com" in location
    assert "scope=openid" in location or "scope=openid%20email%20profile" in location or "openid" in location
    assert "state=" in location


def test_google_oauth_callback_new_user(unauth_client, db, org_a):
    from app.core.security import create_oauth_state
    state = create_oauth_state(org_a.id, "google")

    resp = unauth_client.get(
        f"/api/v1/auth/google/callback?code=mock_sam.altman@google.example.com&state={state}",
        headers={"Accept": "application/json"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["email"] == "sam.altman@google.example.com"
    assert data["user"]["organization_id"] == org_a.id
    assert data["user"]["role"] == "employee"
    assert settings.JWT_COOKIE_NAME in resp.cookies
    assert settings.CSRF_COOKIE_NAME in resp.cookies

    # Check DB user
    user = db.query(User).filter(User.email == "sam.altman@google.example.com").first()
    assert user is not None
    assert user.auth_provider == "google"
    assert user.hashed_password is None


def test_google_oauth_callback_existing_user_linking(unauth_client, db, user_a_owner):
    from app.core.security import create_oauth_state
    orig_password_hash = user_a_owner.hashed_password
    orig_role = user_a_owner.role
    orig_org_id = user_a_owner.organization_id

    state = create_oauth_state(orig_org_id, "google")

    resp = unauth_client.get(
        f"/api/v1/auth/google/callback?code=mock_{user_a_owner.email}&state={state}",
        headers={"Accept": "application/json"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["email"] == user_a_owner.email
    assert data["user"]["id"] == user_a_owner.id
    assert data["user"]["role"] == orig_role

    # DB verify: password hash intact, role preserved, auth_provider updated
    db.refresh(user_a_owner)
    assert user_a_owner.hashed_password == orig_password_hash
    assert user_a_owner.role == orig_role
    assert user_a_owner.auth_provider == "google"


def test_google_oauth_callback_invalid_state(unauth_client):
    resp = unauth_client.get(
        "/api/v1/auth/google/callback?code=mock_user@example.com&state=tampered_invalid_state",
        headers={"Accept": "application/json"},
    )
    assert resp.status_code == 400
    assert "Invalid or expired OAuth state parameter." in resp.json()["detail"]


def test_google_oauth_callback_deactivated_org(unauth_client, db, org_a):
    from datetime import datetime, timezone
    from app.core.security import create_oauth_state

    org_a.deactivated_at = datetime.now(timezone.utc)
    db.commit()

    state = create_oauth_state(org_a.id, "google")
    resp = unauth_client.get(
        f"/api/v1/auth/google/callback?code=mock_new_user@example.com&state={state}",
        headers={"Accept": "application/json"},
    )
    assert resp.status_code == 400
    assert "Organization is deactivated" in resp.json()["detail"]

