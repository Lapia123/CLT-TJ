"""Analytics endpoints: summary stats, equity curve, breakdowns, calendar."""

from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..calculations import summarize
from ..database import get_db
from ..models import Trade, User
from ..serializers import trade_to_dict

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _load_trades(user: User, db: Session) -> list[dict]:
    stmt = select(Trade).where(Trade.user_id == user.id).order_by(Trade.entry_date.asc())
    return [trade_to_dict(t) for t in db.scalars(stmt).all()]


@router.get("/summary")
def summary(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    trades = _load_trades(current_user, db)
    stats = summarize(trades)
    stats["starting_balance"] = current_user.starting_balance
    stats["current_balance"] = round(current_user.starting_balance + stats["net_pnl"], 2)
    return stats


@router.get("/equity-curve")
def equity_curve(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    """Cumulative equity over time, ordered by close date of each closed trade."""
    trades = _load_trades(current_user, db)
    closed = [t for t in trades if t["status"] == "closed" and t["net_pnl"] is not None]
    closed.sort(key=lambda t: t["exit_date"] or t["entry_date"])

    points: list[dict] = []
    equity = current_user.starting_balance
    points.append({"date": None, "equity": round(equity, 2), "trade_id": None, "pnl": 0})
    for t in closed:
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


@router.get("/breakdown")
def breakdown(
    dimension: str = "symbol",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Performance grouped by a dimension: symbol | setup | direction | weekday."""
    trades = _load_trades(current_user, db)
    closed = [t for t in trades if t["status"] == "closed" and t["net_pnl"] is not None]

    weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    def key_for(t: dict) -> str:
        if dimension == "setup":
            return t.get("setup") or "Unspecified"
        if dimension == "direction":
            return t["direction"].capitalize()
        if dimension == "weekday":
            d = t["exit_date"] or t["entry_date"]
            return weekdays[d.weekday()]
        return t["symbol"]

    groups: dict[str, list[dict]] = defaultdict(list)
    for t in closed:
        groups[key_for(t)].append(t)

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
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    """Daily aggregated P&L for a calendar heatmap (keyed by close date)."""
    trades = _load_trades(current_user, db)
    closed = [t for t in trades if t["status"] == "closed" and t["net_pnl"] is not None]

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
