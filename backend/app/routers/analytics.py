"""Analytics: summary, equity curve, drawdown, distributions, breakdowns, calendar."""

from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..calculations import hold_time_bucket, max_drawdown, r_distribution, summarize
from ..database import get_db
from ..models import Account, Trade, User
from ..serializers import trade_to_dict

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _load_trades(user: User, db: Session, account_id: int | None = None) -> list[dict]:
    stmt = select(Trade).where(Trade.user_id == user.id)
    if account_id is not None:
        stmt = stmt.where(Trade.account_id == account_id)
    stmt = stmt.order_by(Trade.entry_date.asc())
    return [trade_to_dict(t) for t in db.scalars(stmt).all()]


def _baseline(user: User, db: Session, account_id: int | None) -> float:
    """Starting equity: the account's balance if filtered, else summed accounts
    or the user's baseline."""
    if account_id is not None:
        acc = db.get(Account, account_id)
        if acc and acc.user_id == user.id:
            return acc.starting_balance
    accounts = db.scalars(select(Account).where(Account.user_id == user.id)).all()
    if accounts:
        return sum(a.starting_balance for a in accounts)
    return user.starting_balance


def _closed_sorted(trades: list[dict]) -> list[dict]:
    closed = [t for t in trades if t["status"] == "closed" and t["net_pnl"] is not None]
    closed.sort(key=lambda t: t["exit_date"] or t["entry_date"])
    return closed


@router.get("/summary")
def summary(
    account_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    trades = _load_trades(current_user, db, account_id)
    stats = summarize(trades)
    baseline = _baseline(current_user, db, account_id)

    equity = baseline
    equity_series = [equity]
    for t in _closed_sorted(trades):
        equity += t["net_pnl"]
        equity_series.append(equity)

    stats["starting_balance"] = round(baseline, 2)
    stats["current_balance"] = round(baseline + stats["net_pnl"], 2)
    stats.update(max_drawdown(equity_series))
    return stats


@router.get("/equity-curve")
def equity_curve(
    account_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    trades = _load_trades(current_user, db, account_id)
    baseline = _baseline(current_user, db, account_id)
    points = [{"date": None, "equity": round(baseline, 2), "trade_id": None, "pnl": 0}]
    equity = baseline
    for t in _closed_sorted(trades):
        equity += t["net_pnl"]
        date = t["exit_date"] or t["entry_date"]
        points.append(
            {
                "date": date.isoformat() if date else None,
                "equity": round(equity, 2),
                "trade_id": t["id"],
                "symbol": t["symbol"],
                "pnl": t["net_pnl"],
            }
        )
    return points


@router.get("/cumulative")
def cumulative_pnl(
    account_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Cumulative net P&L from zero, per closed trade (chronological)."""
    trades = _load_trades(current_user, db, account_id)
    points = [{"index": 0, "cumulative": 0.0, "date": None}]
    total = 0.0
    for i, t in enumerate(_closed_sorted(trades), start=1):
        total += t["net_pnl"]
        date = t["exit_date"] or t["entry_date"]
        points.append(
            {
                "index": i,
                "cumulative": round(total, 2),
                "date": date.isoformat() if date else None,
                "symbol": t["symbol"],
                "pnl": t["net_pnl"],
            }
        )
    return points


@router.get("/r-distribution")
def r_dist(
    account_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return r_distribution(_closed_sorted(_load_trades(current_user, db, account_id)))


@router.get("/time-of-day")
def time_of_day(
    account_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Net P&L and trade count grouped by entry hour (0-23)."""
    closed = _closed_sorted(_load_trades(current_user, db, account_id))
    buckets = {h: {"hour": h, "net_pnl": 0.0, "trades": 0, "wins": 0} for h in range(24)}
    for t in closed:
        h = t["entry_date"].hour
        b = buckets[h]
        b["net_pnl"] += t["net_pnl"]
        b["trades"] += 1
        if t["net_pnl"] > 0:
            b["wins"] += 1
    for b in buckets.values():
        b["net_pnl"] = round(b["net_pnl"], 2)
    return [buckets[h] for h in range(24)]


@router.get("/hold-time")
def hold_time(
    account_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Performance grouped by holding-period bucket."""
    order = ["< 1h", "1-4h", "4-24h", "1-7d", "> 7d", "Unknown"]
    groups: dict[str, list[dict]] = defaultdict(list)
    for t in _closed_sorted(_load_trades(current_user, db, account_id)):
        groups[hold_time_bucket(t["holding_period_hours"])].append(t)
    result = []
    for key in order:
        items = groups.get(key, [])
        if not items:
            continue
        net = sum(i["net_pnl"] for i in items)
        wins = len([i for i in items if i["net_pnl"] > 0])
        result.append(
            {
                "key": key,
                "trades": len(items),
                "net_pnl": round(net, 2),
                "win_rate": round(wins / len(items) * 100, 2),
            }
        )
    return result


@router.get("/breakdown")
def breakdown(
    dimension: str = "symbol",
    account_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Performance grouped by: symbol | setup | direction | weekday | tag | mistake."""
    closed = _closed_sorted(_load_trades(current_user, db, account_id))
    weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    def keys_for(t: dict) -> list[str]:
        if dimension == "setup":
            return [t.get("setup") or "Unspecified"]
        if dimension == "direction":
            return [t["direction"].capitalize()]
        if dimension == "weekday":
            d = t["exit_date"] or t["entry_date"]
            return [weekdays[d.weekday()]]
        if dimension in ("tag", "mistake"):
            field = t.get("tags") if dimension == "tag" else t.get("mistakes")
            parts = [p.strip() for p in (field or "").split(",") if p.strip()]
            return parts or (["None"] if dimension == "tag" else [])
        return [t["symbol"]]

    groups: dict[str, list[dict]] = defaultdict(list)
    for t in closed:
        for key in keys_for(t):
            groups[key].append(t)

    result = []
    for name, items in groups.items():
        net = sum(i["net_pnl"] for i in items)
        wins = len([i for i in items if i["net_pnl"] > 0])
        result.append(
            {
                "key": name,
                "trades": len(items),
                "net_pnl": round(net, 2),
                "wins": wins,
                "win_rate": round(wins / len(items) * 100, 2) if items else 0,
            }
        )
    result.sort(key=lambda r: r["net_pnl"], reverse=True)
    return result


@router.get("/calendar")
def calendar(
    account_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Daily aggregated P&L for a calendar heatmap (keyed by close date)."""
    closed = _closed_sorted(_load_trades(current_user, db, account_id))
    by_day: dict[str, dict] = {}
    for t in closed:
        d = t["exit_date"] or t["entry_date"]
        day = d.date().isoformat()
        bucket = by_day.setdefault(day, {"date": day, "net_pnl": 0.0, "trades": 0})
        bucket["net_pnl"] += t["net_pnl"]
        bucket["trades"] += 1
    for bucket in by_day.values():
        bucket["net_pnl"] = round(bucket["net_pnl"], 2)
    return sorted(by_day.values(), key=lambda b: b["date"])
