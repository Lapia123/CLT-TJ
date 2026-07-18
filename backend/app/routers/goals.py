"""Goal CRUD with live progress computed against actual trade performance."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..calculations import summarize
from ..database import get_db
from ..models import Goal, Trade, User
from ..schemas import GoalCreate, GoalOut, GoalUpdate
from ..serializers import trade_to_dict

router = APIRouter(prefix="/api/goals", tags=["goals"])


def _current_value(goal: Goal, user: User, db: Session) -> float:
    stmt = select(Trade).where(Trade.user_id == user.id)
    if goal.account_id is not None:
        stmt = stmt.where(Trade.account_id == goal.account_id)
    trades = [trade_to_dict(t) for t in db.scalars(stmt).all()]

    if goal.period == "monthly":
        now = datetime.now(timezone.utc)
        def in_month(t):
            d = t.get("exit_date") or t.get("entry_date")
            return d and d.year == now.year and d.month == now.month
        trades = [t for t in trades if in_month(t)]

    stats = summarize(trades)
    if goal.metric == "net_pnl":
        return stats["net_pnl"]
    if goal.metric == "win_rate":
        return stats["win_rate"]
    if goal.metric == "trades":
        return float(stats["closed_trades"])
    if goal.metric == "profit_factor":
        return stats["profit_factor"] if stats["profit_factor"] is not None else 0.0
    return 0.0


def _to_out(goal: Goal, user: User, db: Session) -> dict:
    current = _current_value(goal, user, db)
    progress = (current / goal.target * 100.0) if goal.target else 0.0
    progress = max(0.0, min(progress, 999.0))
    return {
        "id": goal.id,
        "name": goal.name,
        "metric": goal.metric,
        "target": goal.target,
        "period": goal.period,
        "account_id": goal.account_id,
        "created_at": goal.created_at,
        "current": round(current, 2),
        "progress_pct": round(progress, 1),
        "achieved": current >= goal.target,
    }


def _get_owned(goal_id: int, user: User, db: Session) -> Goal:
    goal = db.get(Goal, goal_id)
    if goal is None or goal.user_id != user.id:
        raise HTTPException(status_code=404, detail="Goal not found.")
    return goal


@router.get("", response_model=list[GoalOut])
def list_goals(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    goals = db.scalars(
        select(Goal).where(Goal.user_id == current_user.id).order_by(Goal.created_at)
    ).all()
    return [_to_out(g, current_user, db) for g in goals]


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    goal = Goal(user_id=current_user.id, **payload.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return _to_out(goal, current_user, db)


@router.patch("/{goal_id}", response_model=GoalOut)
def update_goal(
    goal_id: int,
    payload: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    goal = _get_owned(goal_id, current_user, db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(goal, key, value)
    db.commit()
    db.refresh(goal)
    return _to_out(goal, current_user, db)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = _get_owned(goal_id, current_user, db)
    db.delete(goal)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
