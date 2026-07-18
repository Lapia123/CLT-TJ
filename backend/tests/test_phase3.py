"""Tests for Phase 3: account security (change password, delete) and rate limiting."""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture()
def client(monkeypatch):
    os.environ["DATABASE_URL"] = "sqlite://"
    from app import database

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(database, "engine", engine)
    monkeypatch.setattr(database, "SessionLocal", TestingSession)

    from app import main
    from app.database import Base
    from app.ratelimit import _auth_limiter

    _auth_limiter._hits.clear()
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[database.get_db] = override_get_db
    with TestClient(main.app) as c:
        yield c
    main.app.dependency_overrides.clear()


def reg(client, email="s3@t.com", pw="secret1"):
    r = client.post("/api/auth/register", json={"email": email, "name": "S", "password": pw})
    return r.json()["access_token"]


def h(token):
    return {"Authorization": f"Bearer {token}"}


def test_change_password(client):
    token = reg(client, "cp@t.com", "oldpass1")
    # wrong current password rejected
    bad = client.post("/api/auth/change-password", json={"current_password": "nope", "new_password": "newpass1"}, headers=h(token))
    assert bad.status_code == 400
    # correct change
    ok = client.post("/api/auth/change-password", json={"current_password": "oldpass1", "new_password": "newpass1"}, headers=h(token))
    assert ok.status_code == 204
    # old password no longer works, new one does
    assert client.post("/api/auth/login", data={"username": "cp@t.com", "password": "oldpass1"}).status_code == 401
    assert client.post("/api/auth/login", data={"username": "cp@t.com", "password": "newpass1"}).status_code == 200


def test_delete_account_cascades(client):
    token = reg(client, "del@t.com")
    # create some data
    client.post("/api/accounts", json={"name": "A", "starting_balance": 1000}, headers=h(token))
    client.post("/api/goals", json={"name": "g", "metric": "net_pnl", "target": 100}, headers=h(token))
    # delete account
    assert client.delete("/api/auth/me", headers=h(token)).status_code == 204
    # token no longer valid
    assert client.get("/api/auth/me", headers=h(token)).status_code == 401
    # cannot log back in
    assert client.post("/api/auth/login", data={"username": "del@t.com", "password": "secret1"}).status_code == 401


def test_rate_limit_on_auth(client):
    # 10 attempts allowed per window; the 11th should be throttled.
    codes = []
    for i in range(12):
        r = client.post("/api/auth/login", data={"username": f"x{i}@t.com", "password": "bad"})
        codes.append(r.status_code)
    assert 429 in codes
    assert codes[:10] == [401] * 10  # first 10 pass through to auth (and fail creds)
