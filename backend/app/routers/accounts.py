"""Trading account CRUD endpoints (multi-account support)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Account, User
from ..schemas import AccountCreate, AccountOut, AccountUpdate

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


def _get_owned(account_id: int, user: User, db: Session) -> Account:
    account = db.get(Account, account_id)
    if account is None or account.user_id != user.id:
        raise HTTPException(status_code=404, detail="Account not found.")
    return account


def _clear_other_defaults(user_id: int, keep_id: int | None, db: Session) -> None:
    for acc in db.scalars(select(Account).where(Account.user_id == user_id)).all():
        if acc.id != keep_id:
            acc.is_default = False


@router.get("", response_model=list[AccountOut])
def list_accounts(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Account]:
    stmt = select(Account).where(Account.user_id == current_user.id).order_by(Account.created_at)
    return list(db.scalars(stmt).all())


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def create_account(
    payload: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Account:
    account = Account(user_id=current_user.id, **payload.model_dump())
    # First account becomes the default automatically.
    existing = db.scalars(select(Account).where(Account.user_id == current_user.id)).all()
    if not existing:
        account.is_default = True
    if account.is_default:
        _clear_other_defaults(current_user.id, None, db)
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.patch("/{account_id}", response_model=AccountOut)
def update_account(
    account_id: int,
    payload: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Account:
    account = _get_owned(account_id, current_user, db)
    data = payload.model_dump(exclude_unset=True)
    if data.get("is_default"):
        _clear_other_defaults(current_user.id, account_id, db)
    for key, value in data.items():
        setattr(account, key, value)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = _get_owned(account_id, current_user, db)
    db.delete(account)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
