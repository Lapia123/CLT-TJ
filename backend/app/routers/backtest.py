"""Strategy simulator ('backtest') over a user's own trade history.

Applies filter criteria to the journal and reports how that subset would have
performed vs the full record — plus an equity series for the trade-replay view.
This is journal-based backtesting (no external market data required).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..calculations import hold_time_bucket, max_drawdown, summarize
from ..database import get_db
from ..models import Account, Trade, User
from ..schemas import BacktestRequest
from ..serializers import trade_to_dict

router = APIRouter(prefix="/api/backtest", tags=["backtest"])


def _matches(t: dict, req: BacktestRequest) -> bool:
    if req.setups and (t.get("setup") or "Unspecified") not in req.setups:
        return False
    if req.directions and t["direction"] not in req.directions:
        return False
    if req.playbook_ids and t.get("playbook_id") not in req.playbook_ids:
        return False
    if req.min_rating is not None and (t.get("rating") or 0) < req.min_rating:
        return False
    if req.exclude_mistakes and (t.get("mistakes") or "").strip():
        return False
    if req.weekdays:
        d = t.get("exit_date") or t.get("entry_date")
        if d is None or d.weekday() not in req.weekdays:
            return False
    if req.hold_buckets and hold_time_bucket(t.get("holding_period_hours")) not in req.hold_buckets:
        return False
    if req.tags:
        tags = {p.strip() for p in (t.get("tags") or "").split(",") if p.strip()}
        if not tags.intersection(req.tags):
            return False
    return True


def _equity_series(closed: list[dict], baseline: float) -> list[dict]:
    closed = sorted(closed, key=lambda t: t["exit_date"] or t["entry_date"])
    equity = baseline
    pts = [{"index": 0, "equity": round(equity, 2), "date": None, "symbol": None, "pnl": 0}]
    for i, t in enumerate(closed, start=1):
        equity += t["net_pnl"]
        d = t["exit_date"] or t["entry_date"]
        pts.append({
            "index": i,
            "equity": round(equity, 2),
            "date": d.isoformat() if d else None,
            "symbol": t["symbol"],
            "pnl": t["net_pnl"],
        })
    return pts


@router.post("")
def run_backtest(
    req: BacktestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(Trade).where(Trade.user_id == current_user.id)
    if req.account_id is not None:
        stmt = stmt.where(Trade.account_id == req.account_id)
    trades = [trade_to_dict(t) for t in db.scalars(stmt).all()]
    closed_all = [t for t in trades if t["status"] == "closed" and t["net_pnl"] is not None]

    filtered = [t for t in closed_all if _matches(t, req)]

    baseline = current_user.starting_balance
    if req.account_id is not None:
        acc = db.get(Account, req.account_id)
        if acc and acc.user_id == current_user.id:
            baseline = acc.starting_balance

    filtered_stats = summarize(filtered)
    all_stats = summarize(closed_all)
    equity = _equity_series(filtered, baseline)
    filtered_stats.update(max_drawdown([p["equity"] for p in equity]))

    return {
        "matched": len(filtered),
        "total_closed": len(closed_all),
        "baseline": round(baseline, 2),
        "filtered": filtered_stats,
        "all": all_stats,
        "equity_curve": equity,
    }
