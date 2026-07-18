"""AI-style insights endpoint: auto-generated observations from a user's trades."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..insights import generate_insights
from ..models import Trade, User
from ..schemas import Insight
from ..serializers import trade_to_dict

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get("", response_model=list[Insight])
def get_insights(
    account_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    stmt = select(Trade).where(Trade.user_id == current_user.id)
    if account_id is not None:
        stmt = stmt.where(Trade.account_id == account_id)
    trades = [trade_to_dict(t) for t in db.scalars(stmt).all()]
    return generate_insights(trades)
