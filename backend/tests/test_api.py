"""Integration tests for the API using an in-memory SQLite database."""

import os
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture()
def client(monkeypatch):
    # Use a shared in-memory database for the test session.
    os.environ["DATABASE_URL"] = "sqlite://"
    from app import database

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
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


def _register(client, email="t@t.com"):
    r = client.post(
        "/api/auth/register",
        json={"email": email, "name": "Tester", "password": "secret1", "starting_balance": 10000},
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_register_login_me(client):
    token = _register(client)
    me = client.get("/api/auth/me", headers=auth_header(token))
    assert me.status_code == 200
    assert me.json()["email"] == "t@t.com"

    login = client.post(
        "/api/auth/login", data={"username": "t@t.com", "password": "secret1"}
    )
    assert login.status_code == 200
    assert login.json()["access_token"]


def test_duplicate_email_rejected(client):
    _register(client, "dup@t.com")
    r = client.post(
        "/api/auth/register",
        json={"email": "dup@t.com", "name": "X", "password": "secret1"},
    )
    assert r.status_code == 400


def test_trade_crud_and_metrics(client):
    token = _register(client, "trader@t.com")
    h = auth_header(token)
    payload = {
        "symbol": "aapl",
        "direction": "long",
        "status": "closed",
        "quantity": 100,
        "entry_price": 10,
        "exit_price": 12,
        "stop_loss": 9,
        "fees": 0,
        "entry_date": datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat(),
        "exit_date": datetime(2026, 1, 2, tzinfo=timezone.utc).isoformat(),
        "setup": "Breakout",
    }
    r = client.post("/api/trades", json=payload, headers=h)
    assert r.status_code == 201, r.text
    trade = r.json()
    assert trade["symbol"] == "AAPL"  # normalized upper
    assert trade["net_pnl"] == 200.0
    assert trade["r_multiple"] == 2.0
    tid = trade["id"]

    # list
    lst = client.get("/api/trades", headers=h).json()
    assert len(lst) == 1

    # update -> change exit price
    upd = client.patch(f"/api/trades/{tid}", json={"exit_price": 11}, headers=h)
    assert upd.status_code == 200
    assert upd.json()["net_pnl"] == 100.0

    # delete
    assert client.delete(f"/api/trades/{tid}", headers=h).status_code == 204
    assert client.get("/api/trades", headers=h).json() == []


def test_closed_requires_exit_price(client):
    token = _register(client, "v@t.com")
    h = auth_header(token)
    payload = {
        "symbol": "TSLA",
        "direction": "long",
        "status": "closed",
        "quantity": 10,
        "entry_price": 100,
        "entry_date": datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat(),
    }
    r = client.post("/api/trades", json=payload, headers=h)
    assert r.status_code == 422


def test_user_isolation(client):
    t1 = _register(client, "a@t.com")
    t2 = _register(client, "b@t.com")
    payload = {
        "symbol": "SPY",
        "direction": "long",
        "status": "open",
        "quantity": 1,
        "entry_price": 100,
        "entry_date": datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat(),
    }
    tid = client.post("/api/trades", json=payload, headers=auth_header(t1)).json()["id"]
    # user 2 cannot see or fetch user 1's trade
    assert client.get("/api/trades", headers=auth_header(t2)).json() == []
    assert client.get(f"/api/trades/{tid}", headers=auth_header(t2)).status_code == 404


def test_analytics_summary(client):
    token = _register(client, "an@t.com")
    h = auth_header(token)
    for exit_price, net in [(12, 200), (8, -200)]:
        client.post(
            "/api/trades",
            json={
                "symbol": "NVDA",
                "direction": "long",
                "status": "closed",
                "quantity": 100,
                "entry_price": 10,
                "exit_price": exit_price,
                "entry_date": datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat(),
                "exit_date": datetime(2026, 1, 2, tzinfo=timezone.utc).isoformat(),
            },
            headers=h,
        )
    s = client.get("/api/analytics/summary", headers=h).json()
    assert s["closed_trades"] == 2
    assert s["win_rate"] == 50.0
    assert s["current_balance"] == 10000.0

    curve = client.get("/api/analytics/equity-curve", headers=h).json()
    assert len(curve) == 3  # starting point + 2 trades

    requires_auth = client.get("/api/analytics/summary")
    assert requires_auth.status_code == 401
