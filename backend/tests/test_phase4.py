"""Tests for Phase 4: email verification, password reset, and backtest simulator."""

import os
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.email import make_token, read_token


def test_token_roundtrip_and_purpose():
    tok = make_token(7, "verify", 60)
    assert read_token(tok, "verify") == "7"
    # wrong purpose is rejected
    assert read_token(tok, "reset") is None
    # garbage is rejected
    assert read_token("not-a-token", "verify") is None


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


def reg(client, email="p4@t.com"):
    r = client.post("/api/auth/register", json={"email": email, "name": "P", "password": "secret1"})
    return r.json()


def test_new_user_is_unverified_then_verifies(client):
    data = reg(client, "verify@t.com")
    assert data["user"]["is_verified"] is False
    uid = data["user"]["id"]

    tok = make_token(uid, "verify", 60)
    r = client.post("/api/auth/verify", json={"token": tok})
    assert r.status_code == 200
    assert r.json()["is_verified"] is True

    # bad token rejected
    assert client.post("/api/auth/verify", json={"token": "bad"}).status_code == 400


def test_password_reset_flow(client):
    data = reg(client, "reset@t.com")
    uid = data["user"]["id"]

    # forgot-password always accepts (no user enumeration)
    assert client.post("/api/auth/forgot-password", json={"email": "reset@t.com"}).status_code == 202
    assert client.post("/api/auth/forgot-password", json={"email": "nobody@t.com"}).status_code == 202

    tok = make_token(uid, "reset", 30)
    r = client.post("/api/auth/reset-password", json={"token": tok, "new_password": "brandnew1"})
    assert r.status_code == 200
    # old password fails, new works
    assert client.post("/api/auth/login", data={"username": "reset@t.com", "password": "secret1"}).status_code == 401
    assert client.post("/api/auth/login", data={"username": "reset@t.com", "password": "brandnew1"}).status_code == 200


def _trade(client, h, setup, direction, exit_price, rating=None):
    return client.post(
        "/api/trades",
        json={
            "symbol": "AAPL", "direction": direction, "status": "closed",
            "quantity": 100, "entry_price": 10, "exit_price": exit_price, "setup": setup, "rating": rating,
            "entry_date": datetime(2026, 1, 5, tzinfo=timezone.utc).isoformat(),
            "exit_date": datetime(2026, 1, 6, tzinfo=timezone.utc).isoformat(),
        },
        headers=h,
    )


def test_backtest_filters(client):
    data = reg(client, "bt@t.com")
    h = {"Authorization": f"Bearer {data['access_token']}"}
    _trade(client, h, "Breakout", "long", 12)   # +200
    _trade(client, h, "Breakout", "long", 11)   # +100
    _trade(client, h, "Reversal", "long", 8)    # -200

    # Only Breakout longs → +300 over 2 trades
    r = client.post("/api/backtest", json={"setups": ["Breakout"]}, headers=h).json()
    assert r["matched"] == 2
    assert r["total_closed"] == 3
    assert r["filtered"]["net_pnl"] == 300.0
    assert r["all"]["net_pnl"] == 100.0
    assert len(r["equity_curve"]) == 3  # baseline + 2 trades
