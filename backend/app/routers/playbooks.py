"""Playbook (trading strategy) CRUD + per-playbook performance stats."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..calculations import summarize
from ..database import get_db
from ..models import Playbook, Trade, User
from ..schemas import PlaybookCreate, PlaybookOut, PlaybookUpdate
from ..serializers import trade_to_dict

router = APIRouter(prefix="/api/playbooks", tags=["playbooks"])


def _get_owned(playbook_id: int, user: User, db: Session) -> Playbook:
    pb = db.get(Playbook, playbook_id)
    if pb is None or pb.user_id != user.id:
        raise HTTPException(status_code=404, detail="Playbook not found.")
    return pb


@router.get("", response_model=list[PlaybookOut])
def list_playbooks(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Playbook]:
    stmt = select(Playbook).where(Playbook.user_id == current_user.id).order_by(Playbook.name)
    return list(db.scalars(stmt).all())


@router.post("", response_model=PlaybookOut, status_code=status.HTTP_201_CREATED)
def create_playbook(
    payload: PlaybookCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Playbook:
    pb = Playbook(user_id=current_user.id, **payload.model_dump())
    db.add(pb)
    db.commit()
    db.refresh(pb)
    return pb


@router.get("/stats")
def playbook_stats(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    """Performance summary per playbook (plus an 'Unassigned' bucket)."""
    playbooks = db.scalars(
        select(Playbook).where(Playbook.user_id == current_user.id)
    ).all()
    trades = db.scalars(select(Trade).where(Trade.user_id == current_user.id)).all()
    dicts = [trade_to_dict(t) for t in trades]

    result = []
    for pb in playbooks:
        pb_trades = [t for t in dicts if t["playbook_id"] == pb.id]
        stats = summarize(pb_trades)
        result.append({"id": pb.id, "name": pb.name, **stats})

    unassigned = [t for t in dicts if t["playbook_id"] is None]
    if unassigned:
        result.append({"id": None, "name": "Unassigned", **summarize(unassigned)})
    return result


@router.patch("/{playbook_id}", response_model=PlaybookOut)
def update_playbook(
    playbook_id: int,
    payload: PlaybookUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Playbook:
    pb = _get_owned(playbook_id, current_user, db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(pb, key, value)
    db.commit()
    db.refresh(pb)
    return pb


@router.delete("/{playbook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_playbook(
    playbook_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pb = _get_owned(playbook_id, current_user, db)
    db.delete(pb)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
