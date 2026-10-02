import os
import sys
from pathlib import Path
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# Add fast_api_server directory to sys.path
TEST_FILE = Path(__file__).resolve()
SERVER_DIR = TEST_FILE.parents[1]
ROOT_DIR = SERVER_DIR.parent
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Force test environment before importing app settings
os.environ["ENVIRONMENT"] = "test"
os.environ["REDIS_TIMEOUT_SECONDS"] = "1"



from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import hash_password, create_access_token, generate_csrf_token
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.models.document import Document
from app.models.event import CompanyEvent
from app.models.conflict import Conflict
from app.models.agent import AgentProfile
from app.models.audit import AuditLog
from app.main import app

# SQLite test engine with foreign key enforcement
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})


@event.listens_for(test_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db():
    from app.events.bus import RedisEventBus
    RedisEventBus.reset_in_memory()

    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    # Override get_db in FastAPI
    app.dependency_overrides[get_db] = lambda: session

    yield session

    session.close()
    if transaction.is_active:
        transaction.rollback()
    connection.close()
    app.dependency_overrides.pop(get_db, None)
    RedisEventBus.reset_in_memory()


@pytest.fixture
def org_a(db):
    org = Organization(
        id="org-alpha",
        name="Alpha Corporation",
        slug="alpha-corp",
        domain="alpha.example.com",
        plan="enterprise",
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


@pytest.fixture
def org_b(db):
    org = Organization(
        id="org-beta",
        name="Beta Industries",
        slug="beta-ind",
        domain="beta.example.com",
        plan="enterprise",
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


@pytest.fixture
def user_a_owner(db, org_a):
    user = User(
        id="usr-alice-owner",
        organization_id=org_a.id,
        email="alice@alpha.example.com",
        hashed_password=hash_password("Password123!"),
        full_name="Alice Owner",
        role=UserRole.OWNER.value,
        auth_provider="local",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def user_a_admin(db, org_a):
    user = User(
        id="usr-alex-admin",
        organization_id=org_a.id,
        email="alex@alpha.example.com",
        hashed_password=hash_password("Password123!"),
        full_name="Alex Admin",
        role=UserRole.ADMIN.value,
        auth_provider="local",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def user_a_employee(db, org_a):
    user = User(
        id="usr-adam-employee",
        organization_id=org_a.id,
        email="adam@alpha.example.com",
        hashed_password=hash_password("Password123!"),
        full_name="Adam Employee",
        role=UserRole.EMPLOYEE.value,
        auth_provider="local",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def user_b_admin(db, org_b):
    user = User(
        id="usr-bill-admin",
        organization_id=org_b.id,
        email="bill@beta.example.com",
        hashed_password=hash_password("Password123!"),
        full_name="Bill Admin",
        role=UserRole.ADMIN.value,
        auth_provider="local",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def user_b_owner(db, org_b):
    user = User(
        id="usr-bob-owner",
        organization_id=org_b.id,
        email="bob@beta.example.com",
        hashed_password=hash_password("Password123!"),
        full_name="Bob Owner",
        role=UserRole.OWNER.value,
        auth_provider="local",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def user_b_employee(db, org_b):
    user = User(
        id="usr-brian-employee",
        organization_id=org_b.id,
        email="brian@beta.example.com",
        hashed_password=hash_password("Password123!"),
        full_name="Brian Employee",
        role=UserRole.EMPLOYEE.value,
        auth_provider="local",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_authenticated_client(user: User) -> TestClient:
    client = TestClient(app)
    token = create_access_token({
        "sub": user.id,
        "org_id": user.organization_id,
        "email": user.email,
        "name": user.full_name,
        "role": user.role,
    })
    csrf_token = generate_csrf_token()

    # Set cookies
    client.cookies.set(settings.JWT_COOKIE_NAME, token)
    client.cookies.set(settings.CSRF_COOKIE_NAME, csrf_token)

    # Set default CSRF header for state-changing requests
    client.headers.update({
        settings.CSRF_HEADER_NAME: csrf_token,
        "Authorization": f"Bearer {token}",
    })
    return client


@pytest.fixture
def client_a_owner(user_a_owner):
    return create_authenticated_client(user_a_owner)


@pytest.fixture
def client_a_admin(user_a_admin):
    return create_authenticated_client(user_a_admin)


@pytest.fixture
def client_a_employee(user_a_employee):
    return create_authenticated_client(user_a_employee)


@pytest.fixture
def client_b_owner(user_b_owner):
    return create_authenticated_client(user_b_owner)


@pytest.fixture
def client_b_admin(user_b_admin):
    return create_authenticated_client(user_b_admin)


@pytest.fixture
def client_b_employee(user_b_employee):
    return create_authenticated_client(user_b_employee)


@pytest.fixture
def unauth_client():
    return TestClient(app)
