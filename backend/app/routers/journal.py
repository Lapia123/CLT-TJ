"""Journal (daily notes) CRUD endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import JournalEntry, User
from ..schemas import JournalCreate, JournalOut, JournalUpdate

router = APIRouter(prefix="/api/journal", tags=["journal"])


def _get_owned(entry_id: int, user: User, db: Session) -> JournalEntry:
    entry = db.get(JournalEntry, entry_id)
    if entry is None or entry.user_id != user.id:
        raise HTTPException(status_code=404, detail="Journal entry not found.")
    return entry


@router.get("", response_model=list[JournalOut])
def list_entries(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[JournalEntry]:
    stmt = (
        select(JournalEntry)
        .where(JournalEntry.user_id == current_user.id)
        .order_by(JournalEntry.entry_date.desc())
    )
    return list(db.scalars(stmt).all())


@router.post("", response_model=JournalOut, status_code=status.HTTP_201_CREATED)
def create_entry(
    payload: JournalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JournalEntry:
    entry = JournalEntry(user_id=current_user.id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/{entry_id}", response_model=JournalOut)
def update_entry(
    entry_id: int,
    payload: JournalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JournalEntry:
    entry = _get_owned(entry_id, current_user, db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = _get_owned(entry_id, current_user, db)
    db.delete(entry)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
