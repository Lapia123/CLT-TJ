"""Pure trade-metric calculations.

Kept dependency-free and side-effect-free so they are trivial to unit test.
All monetary values are rounded to 2 decimals to avoid float-drift in the
ledger, mirroring standard accounting practice.
"""

from __future__ import annotations

from dataclasses import dataclass


def _round(value: float | None) -> float | None:
    return round(value, 2) if value is not None else None


@dataclass
class TradeMetrics:
    gross_pnl: float | None
    net_pnl: float | None
    return_pct: float | None
    r_multiple: float | None
    is_win: bool | None
    holding_period_hours: float | None


def compute_pnl(direction: str, quantity: float, entry_price: float, exit_price: float) -> float:
    """Gross P&L for a closed position (before fees)."""
    if direction == "long":
        return (exit_price - entry_price) * quantity
    return (entry_price - exit_price) * quantity


def compute_metrics(trade: dict) -> TradeMetrics:
    """Compute derived metrics for a trade given its raw fields.

    `trade` is a plain dict with keys: direction, quantity, entry_price,
    exit_price, stop_loss, fees, entry_date, exit_date, status.
    Open trades (no exit_price) return None for P&L-derived fields.
    """
    direction = trade["direction"]
    quantity = float(trade["quantity"])
    entry_price = float(trade["entry_price"])
    exit_price = trade.get("exit_price")
    stop_loss = trade.get("stop_loss")
    fees = float(trade.get("fees") or 0.0)

    if exit_price is None or trade.get("status") != "closed":
        return TradeMetrics(None, None, None, None, None, None)

    exit_price = float(exit_price)
    gross = compute_pnl(direction, quantity, entry_price, exit_price)
    net = gross - fees

    cost_basis = entry_price * quantity
    return_pct = (net / cost_basis * 100.0) if cost_basis else None

    r_multiple = None
    if stop_loss is not None:
        risk_per_unit = abs(entry_price - float(stop_loss))
        risk = risk_per_unit * quantity
        if risk > 0:
            r_multiple = net / risk

    holding_hours = None
    entry_date = trade.get("entry_date")
    exit_date = trade.get("exit_date")
    if entry_date and exit_date:
        delta = exit_date - entry_date
        holding_hours = delta.total_seconds() / 3600.0

    return TradeMetrics(
        gross_pnl=_round(gross),
        net_pnl=_round(net),
        return_pct=_round(return_pct),
        r_multiple=_round(r_multiple),
        is_win=(net > 0) if net is not None else None,
        holding_period_hours=_round(holding_hours),
    )


def max_drawdown(equity_points: list[float]) -> dict:
    """Compute max drawdown (absolute and percent) over a sequence of equity values."""
    if not equity_points:
        return {"max_drawdown": 0.0, "max_drawdown_pct": 0.0}
    peak = equity_points[0]
    max_dd = 0.0
    max_dd_pct = 0.0
    for value in equity_points:
        if value > peak:
            peak = value
        dd = peak - value
        dd_pct = (dd / peak * 100.0) if peak else 0.0
        if dd > max_dd:
            max_dd = dd
        if dd_pct > max_dd_pct:
            max_dd_pct = dd_pct
    return {"max_drawdown": round(max_dd, 2), "max_drawdown_pct": round(max_dd_pct, 2)}


# Buckets (in R) for the R-multiple distribution histogram.
R_BUCKETS = [
    ("< -3R", -999, -3),
    ("-3R..-2R", -3, -2),
    ("-2R..-1R", -2, -1),
    ("-1R..0R", -1, 0),
    ("0R..1R", 0, 1),
    ("1R..2R", 1, 2),
    ("2R..3R", 2, 3),
    ("> 3R", 3, 999),
]


def r_distribution(closed_trades: list[dict]) -> list[dict]:
    """Histogram of R-multiples across closed trades that have an R value."""
    counts = {label: 0 for label, _, _ in R_BUCKETS}
    for t in closed_trades:
        r = t.get("r_multiple")
        if r is None:
            continue
        for label, lo, hi in R_BUCKETS:
            if lo <= r < hi:
                counts[label] += 1
                break
    return [{"bucket": label, "count": counts[label]} for label, _, _ in R_BUCKETS]


def hold_time_bucket(hours: float | None) -> str:
    """Human label for a holding period, used to group performance by duration."""
    if hours is None:
        return "Unknown"
    if hours < 1:
        return "< 1h"
    if hours < 4:
        return "1-4h"
    if hours < 24:
        return "4-24h"
    if hours < 24 * 7:
        return "1-7d"
    return "> 7d"


def summarize(trades: list[dict]) -> dict:
    """Aggregate portfolio-level statistics over a list of trade dicts.

    Only closed trades contribute to P&L stats. Returns a dict suitable for
    direct JSON serialization.
    """
    closed = [t for t in trades if t.get("status") == "closed" and t.get("net_pnl") is not None]
    wins = [t for t in closed if t["net_pnl"] > 0]
    losses = [t for t in closed if t["net_pnl"] < 0]
    breakeven = [t for t in closed if t["net_pnl"] == 0]

    gross_profit = sum(t["net_pnl"] for t in wins)
    gross_loss = sum(t["net_pnl"] for t in losses)  # negative
    net_pnl = sum(t["net_pnl"] for t in closed)

    total_closed = len(closed)
    win_rate = (len(wins) / total_closed * 100.0) if total_closed else 0.0
    avg_win = (gross_profit / len(wins)) if wins else 0.0
    avg_loss = (gross_loss / len(losses)) if losses else 0.0
    profit_factor = (gross_profit / abs(gross_loss)) if gross_loss != 0 else (
        float("inf") if gross_profit > 0 else 0.0
    )
    expectancy = (net_pnl / total_closed) if total_closed else 0.0

    r_values = [t["r_multiple"] for t in closed if t.get("r_multiple") is not None]
    avg_r = (sum(r_values) / len(r_values)) if r_values else None

    best = max((t["net_pnl"] for t in closed), default=0.0)
    worst = min((t["net_pnl"] for t in closed), default=0.0)

    # Streaks (chronological by exit date).
    ordered = sorted(closed, key=lambda t: t.get("exit_date") or t.get("entry_date"))
    cur_win = cur_loss = max_win = max_loss = 0
    for t in ordered:
        if t["net_pnl"] > 0:
            cur_win += 1
            cur_loss = 0
        elif t["net_pnl"] < 0:
            cur_loss += 1
            cur_win = 0
        max_win = max(max_win, cur_win)
        max_loss = max(max_loss, cur_loss)

    return {
        "total_trades": len(trades),
        "closed_trades": total_closed,
        "open_trades": len([t for t in trades if t.get("status") == "open"]),
        "wins": len(wins),
        "losses": len(losses),
        "breakeven": len(breakeven),
        "net_pnl": round(net_pnl, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "win_rate": round(win_rate, 2),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "profit_factor": (round(profit_factor, 2) if profit_factor != float("inf") else None),
        "expectancy": round(expectancy, 2),
        "avg_r_multiple": (round(avg_r, 2) if avg_r is not None else None),
        "best_trade": round(best, 2),
        "worst_trade": round(worst, 2),
        "max_win_streak": max_win,
        "max_loss_streak": max_loss,
    }
