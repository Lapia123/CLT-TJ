"""Integration tests for accounts, playbooks, CSV import and advanced analytics."""

import io
import os
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture()
def client(monkeypatch):
    os.environ["DATABASE_URL"] = "sqlite://"
    from app import database

    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
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


def token(client, email="f@t.com"):
    r = client.post(
        "/api/auth/register",
        json={"email": email, "name": "F", "password": "secret1", "starting_balance": 10000},
    )
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_account_crud_and_default(client):
    h = token(client, "acc@t.com")
    a1 = client.post("/api/accounts", json={"name": "Main", "starting_balance": 5000}, headers=h).json()
    assert a1["is_default"] is True  # first account is default
    a2 = client.post("/api/accounts", json={"name": "Prop", "starting_balance": 100000, "is_default": True}, headers=h).json()
    assert a2["is_default"] is True
    accounts = client.get("/api/accounts", headers=h).json()
    defaults = [a for a in accounts if a["is_default"]]
    assert len(defaults) == 1 and defaults[0]["id"] == a2["id"]


def test_playbook_crud_and_stats(client):
    h = token(client, "pb@t.com")
    pb = client.post("/api/playbooks", json={"name": "Breakout", "rules": "vol"}, headers=h).json()
    # a winning trade on this playbook
    client.post(
        "/api/trades",
        json={
            "symbol": "AAPL", "direction": "long", "status": "closed",
            "quantity": 100, "entry_price": 10, "exit_price": 12,
            "entry_date": datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat(),
            "exit_date": datetime(2026, 1, 2, tzinfo=timezone.utc).isoformat(),
            "playbook_id": pb["id"],
        },
        headers=h,
    )
    stats = client.get("/api/playbooks/stats", headers=h).json()
    row = next(s for s in stats if s["id"] == pb["id"])
    assert row["net_pnl"] == 200.0
    assert row["win_rate"] == 100.0


def test_trade_images_and_rating(client):
    h = token(client, "img@t.com")
    t = client.post(
        "/api/trades",
        json={
            "symbol": "TSLA", "direction": "long", "status": "open",
            "quantity": 10, "entry_price": 100,
            "entry_date": datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat(),
            "images": ["https://img.example/chart1.png"], "rating": 4,
            "mistakes": "FOMO",
        },
        headers=h,
    ).json()
    assert t["images"] == ["https://img.example/chart1.png"]
    assert t["rating"] == 4
    # round-trips on fetch
    fetched = client.get(f"/api/trades/{t['id']}", headers=h).json()
    assert fetched["images"] == ["https://img.example/chart1.png"]
    assert fetched["mistakes"] == "FOMO"


def test_csv_import_preview_and_commit(client):
    h = token(client, "csv@t.com")
    csv_data = (
        "symbol,direction,status,quantity,entry_price,exit_price,entry_date,exit_date\n"
        "aapl,long,closed,100,10,12,2026-01-01 09:30,2026-01-01 15:00\n"
        "tsla,long,closed,10,100,,2026-01-02 09:30,\n"  # invalid: closed w/o exit
        "msft,short,open,50,200,,2026-01-03 10:00,\n"
    )

    def upload(commit):
        return client.post(
            f"/api/trades/import?commit={commit}",
            files={"file": ("t.csv", io.BytesIO(csv_data.encode()), "text/csv")},
            headers=h,
        ).json()

    preview = upload("false")
    assert preview["total"] == 3
    assert preview["valid"] == 2
    assert preview["invalid"] == 1
    assert preview["imported"] == 0

    committed = upload("true")
    assert committed["imported"] == 2
    trades = client.get("/api/trades", headers=h).json()
    assert len(trades) == 2


def test_import_template(client):
    h = token(client, "tpl@t.com")
    r = client.get("/api/trades/import/template", headers=h)
    assert r.status_code == 200
    assert "symbol" in r.text and "entry_price" in r.text


def test_advanced_analytics_endpoints(client):
    h = token(client, "adv@t.com")
    for entry, exit_p, hour in [(10, 12, 9), (10, 8, 10), (10, 13, 9)]:
        client.post(
            "/api/trades",
            json={
                "symbol": "NVDA", "direction": "long", "status": "closed",
                "quantity": 100, "entry_price": entry, "exit_price": exit_p, "stop_loss": 9,
                "entry_date": datetime(2026, 1, 1, hour, 0, tzinfo=timezone.utc).isoformat(),
                "exit_date": datetime(2026, 1, 1, hour + 2, 0, tzinfo=timezone.utc).isoformat(),
            },
            headers=h,
        )
    summary = client.get("/api/analytics/summary", headers=h).json()
    assert "max_drawdown" in summary
    assert summary["closed_trades"] == 3

    cum = client.get("/api/analytics/cumulative", headers=h).json()
    assert cum[-1]["cumulative"] == summary["net_pnl"]

    rdist = client.get("/api/analytics/r-distribution", headers=h).json()
    assert sum(b["count"] for b in rdist) == 3

    tod = client.get("/api/analytics/time-of-day", headers=h).json()
    assert len(tod) == 24
    assert tod[9]["trades"] == 2

    hold = client.get("/api/analytics/hold-time", headers=h).json()
    assert sum(b["trades"] for b in hold) == 3

    tagbreak = client.get("/api/analytics/breakdown?dimension=weekday", headers=h).json()
    assert len(tagbreak) >= 1
