"""Unit tests for the pure calculation layer."""

from datetime import datetime, timedelta, timezone

from app.calculations import compute_metrics, compute_pnl, summarize


def test_long_pnl_profit():
    assert compute_pnl("long", 100, 10.0, 12.0) == 200.0


def test_short_pnl_profit():
    assert compute_pnl("short", 100, 12.0, 10.0) == 200.0


def test_metrics_closed_long_with_r_multiple():
    entry = datetime(2026, 1, 1, tzinfo=timezone.utc)
    trade = {
        "direction": "long",
        "quantity": 100,
        "entry_price": 10.0,
        "exit_price": 12.0,
        "stop_loss": 9.0,  # risk = 1.0 * 100 = 100
        "fees": 0.0,
        "status": "closed",
        "entry_date": entry,
        "exit_date": entry + timedelta(hours=5),
    }
    m = compute_metrics(trade)
    assert m.gross_pnl == 200.0
    assert m.net_pnl == 200.0
    assert m.return_pct == 20.0
    assert m.r_multiple == 2.0  # 200 net / 100 risk
    assert m.is_win is True
    assert m.holding_period_hours == 5.0


def test_metrics_open_trade_returns_none():
    trade = {
        "direction": "long",
        "quantity": 10,
        "entry_price": 100.0,
        "exit_price": None,
        "stop_loss": None,
        "fees": 0.0,
        "status": "open",
        "entry_date": datetime.now(timezone.utc),
        "exit_date": None,
    }
    m = compute_metrics(trade)
    assert m.net_pnl is None
    assert m.is_win is None


def test_fees_reduce_net_pnl():
    trade = {
        "direction": "long",
        "quantity": 100,
        "entry_price": 10.0,
        "exit_price": 12.0,
        "stop_loss": None,
        "fees": 15.0,
        "status": "closed",
        "entry_date": datetime.now(timezone.utc),
        "exit_date": None,
    }
    m = compute_metrics(trade)
    assert m.gross_pnl == 200.0
    assert m.net_pnl == 185.0


def _closed(net, exit_dt, r=None):
    return {
        "status": "closed",
        "net_pnl": net,
        "r_multiple": r,
        "entry_date": exit_dt,
        "exit_date": exit_dt,
    }


def test_summarize_win_rate_and_profit_factor():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    trades = [
        _closed(100, base),
        _closed(200, base + timedelta(days=1)),
        _closed(-50, base + timedelta(days=2)),
        _closed(-50, base + timedelta(days=3)),
    ]
    s = summarize(trades)
    assert s["closed_trades"] == 4
    assert s["wins"] == 2
    assert s["losses"] == 2
    assert s["win_rate"] == 50.0
    assert s["net_pnl"] == 200.0
    assert s["gross_profit"] == 300.0
    assert s["gross_loss"] == -100.0
    assert s["profit_factor"] == 3.0
    assert s["max_win_streak"] == 2
    assert s["max_loss_streak"] == 2


def test_summarize_empty():
    s = summarize([])
    assert s["net_pnl"] == 0
    assert s["win_rate"] == 0
