"""Tests for Phase 2: insights engine, goals, and CSV export."""

import os
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.insights import generate_insights


def _closed(net, day, setup="Breakout", direction="long", rating=None, mistakes=None):
    d = datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(days=day)
    return {
        "status": "closed", "net_pnl": net, "setup": setup, "direction": direction,
        "rating": rating, "mistakes": mistakes, "entry_date": d, "exit_date": d,
        "r_multiple": None,
    }


def test_insights_not_enough_data():
    out = generate_insights([_closed(10, 0)])
    assert out[0]["key"] == "not_enough_data"


def test_insights_positive_expectancy_and_setup():
    trades = [_closed(100, i) for i in range(6)] + [_closed(-20, i + 6) for i in range(3)]
    out = generate_insights(trades)
    keys = {o["key"] for o in out}
    assert "expectancy" in keys
    exp = next(o for o in out if o["key"] == "expectancy")
    assert exp["sentiment"] == "positive"


def test_insights_worst_setup_detected():
    trades = (
        [_closed(50, i, setup="Breakout") for i in range(4)]
        + [_closed(-80, i + 4, setup="Reversal") for i in range(4)]
    )
    out = generate_insights(trades)
    keys = {o["key"] for o in out}
    assert "best_setup" in keys or "worst_setup" in keys


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


def token(client, email="p2@t.com"):
    r = client.post("/api/auth/register", json={"email": email, "name": "P", "password": "secret1"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _make_trade(client, h, net_via_exit):
    entry, exit_p = 10, 10 + net_via_exit / 100  # 100 qty
    return client.post(
        "/api/trades",
        json={
            "symbol": "AAPL", "direction": "long", "status": "closed",
            "quantity": 100, "entry_price": entry, "exit_price": exit_p,
            "entry_date": datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat(),
            "exit_date": datetime(2026, 1, 2, tzinfo=timezone.utc).isoformat(),
        },
        headers=h,
    )


def test_goal_progress(client):
    h = token(client, "goal@t.com")
    # net +200 total
    _make_trade(client, h, 200)
    g = client.post(
        "/api/goals",
        json={"name": "Hit $1k", "metric": "net_pnl", "target": 1000, "period": "all_time"},
        headers=h,
    ).json()
    assert g["current"] == 200.0
    assert g["progress_pct"] == 20.0
    assert g["achieved"] is False

    # win_rate goal
    g2 = client.post(
        "/api/goals",
        json={"name": "60% win", "metric": "win_rate", "target": 60},
        headers=h,
    ).json()
    assert g2["current"] == 100.0
    assert g2["achieved"] is True

    goals = client.get("/api/goals", headers=h).json()
    assert len(goals) == 2


def test_insights_endpoint(client):
    h = token(client, "ins@t.com")
    for _ in range(6):
        _make_trade(client, h, 150)
    out = client.get("/api/insights", headers=h).json()
    assert isinstance(out, list) and len(out) >= 1
    assert any(o["key"] == "expectancy" for o in out)


def test_csv_export(client):
    h = token(client, "exp@t.com")
    _make_trade(client, h, 100)
    r = client.get("/api/trades/export", headers=h)
    assert r.status_code == 200
    assert "symbol,direction" in r.text
    assert "AAPL" in r.text
