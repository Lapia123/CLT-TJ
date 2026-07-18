"""Trade CRUD endpoints with filtering and validation."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Trade, User
from ..schemas import TradeCreate, TradeOut, TradeUpdate
from ..serializers import trade_to_dict

router = APIRouter(prefix="/api/trades", tags=["trades"])


def _validate_close(status_value: str, exit_price, exit_date) -> None:
    if status_value == "closed":
        if exit_price is None:
            raise HTTPException(status_code=422, detail="A closed trade requires an exit price.")
        if exit_date is None:
            raise HTTPException(status_code=422, detail="A closed trade requires an exit date.")


def _get_owned_trade(trade_id: int, user: User, db: Session) -> Trade:
    trade = db.get(Trade, trade_id)
    if trade is None or trade.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trade not found.")
    return trade


@router.get("", response_model=list[TradeOut])
def list_trades(
    status_filter: str | None = Query(default=None, alias="status"),
    symbol: str | None = None,
    setup: str | None = None,
    direction: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = Query(default=500, le=2000, ge=1),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    stmt = select(Trade).where(Trade.user_id == current_user.id)
    if status_filter:
        stmt = stmt.where(Trade.status == status_filter)
    if symbol:
        stmt = stmt.where(Trade.symbol == symbol.strip().upper())
    if setup:
        stmt = stmt.where(Trade.setup == setup)
    if direction:
        stmt = stmt.where(Trade.direction == direction)
    if start:
        stmt = stmt.where(Trade.entry_date >= start)
    if end:
        stmt = stmt.where(Trade.entry_date <= end)

    stmt = stmt.order_by(Trade.entry_date.desc()).limit(limit).offset(offset)
    trades = db.scalars(stmt).all()
    return [trade_to_dict(t) for t in trades]


@router.post("", response_model=TradeOut, status_code=status.HTTP_201_CREATED)
def create_trade(
    payload: TradeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _validate_close(payload.status, payload.exit_price, payload.exit_date)

    trade = Trade(user_id=current_user.id, **payload.model_dump())
    db.add(trade)
    db.commit()
    db.refresh(trade)
    return trade_to_dict(trade)


@router.get("/{trade_id}", response_model=TradeOut)
def get_trade(
    trade_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return trade_to_dict(_get_owned_trade(trade_id, current_user, db))


@router.patch("/{trade_id}", response_model=TradeOut)
def update_trade(
    trade_id: int,
    payload: TradeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    trade = _get_owned_trade(trade_id, current_user, db)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(trade, key, value)

    # Re-validate the resulting state after applying the patch.
    _validate_close(trade.status, trade.exit_price, trade.exit_date)

    db.commit()
    db.refresh(trade)
    return trade_to_dict(trade)


@router.delete("/{trade_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trade(
    trade_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trade = _get_owned_trade(trade_id, current_user, db)
    db.delete(trade)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
