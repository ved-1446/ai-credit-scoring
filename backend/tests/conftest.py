"""
conftest.py — Shared fixtures for all backend tests.
Uses an in-memory SQLite database and FastAPI TestClient.
"""

import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set test environment BEFORE importing the app
os.environ["DATABASE_URL"] = "sqlite://"  # in-memory SQLite
os.environ["SECRET_KEY"] = "test-secret-key-that-is-at-least-32-bytes-long!"
os.environ["ADMIN_EMAIL"] = "admin@test.com"
os.environ["ADMIN_PASSWORD"] = "adminpass123"
artifacts_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "artifacts"))
os.environ["ARTIFACTS_DIR"] = artifacts_dir

from sqlalchemy.pool import StaticPool
from app.db import Base, get_db
from app.main import app
from app.ml.loader import load_artifacts

# Preload artifacts so ML-dependent tests can run
load_artifacts(artifacts_dir)

# Create a test engine and session using StaticPool so in-memory SQLite is shared across threads/sessions
test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)


def override_get_db():
    """Yield a test database session."""
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


# Override the DB dependency with our test database
app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    """Create all tables before each test, drop them after."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client():
    """Return a TestClient for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def seed_admin(client):
    """Seed an admin user directly in the test database."""
    from app.security import hash_password
    from app.models import User

    db = TestSession()
    admin = User(
        email="admin@test.com",
        full_name="Test Admin",
        password_hash=hash_password("adminpass123"),
        role="admin",
    )
    db.add(admin)
    db.commit()
    db.close()


@pytest.fixture
def register_user(client):
    """Register a test user and return the response."""
    resp = client.post("/auth/register", json={
        "email": "user@test.com",
        "password": "testpass123",
        "full_name": "Test User",
    })
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
def auth_token(client, register_user):
    """Register + login a test user, return the JWT."""
    resp = client.post("/auth/login", json={
        "email": "user@test.com",
        "password": "testpass123",
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.fixture
def auth_headers(auth_token):
    """Return Authorization headers for a test user."""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def admin_token(client, seed_admin):
    """Login as admin and return the JWT."""
    resp = client.post("/auth/login", json={
        "email": "admin@test.com",
        "password": "adminpass123",
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.fixture
def admin_headers(admin_token):
    """Return Authorization headers for an admin."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def consent_id(client, auth_headers):
    """Get a valid consent_id for the test user."""
    resp = client.post("/consent", json={
        "policy_version": "v1",
        "accepted": True,
    }, headers=auth_headers)
    assert resp.status_code == 201
    return resp.json()["consent_id"]


# Sample valid prediction inputs (contract §4.1 example)
SAMPLE_INPUTS = {
    "age_years": 34,
    "gender": "F",
    "amt_income_total": 180000,
    "amt_credit": 450000,
    "amt_annuity": 22500,
    "years_employed": 6.5,
    "name_contract_type": "Cash loans",
    "name_income_type": "Working",
    "name_education_type": "Higher education",
    "name_family_status": "Married",
    "name_housing_type": "House / apartment",
    "organization_type": "Services",
    "flag_own_car": False,
    "flag_own_realty": True,
    "cnt_children": 1,
    "cnt_fam_members": 3,
    "ext_source_2": 0.58,
    "ext_source_3": 0.42,
}
