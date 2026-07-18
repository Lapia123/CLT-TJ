"""Authentication endpoints: register, login, current user, profile update."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import create_access_token, get_current_user, hash_password, verify_password
from ..database import get_db
from ..email import (
    read_token,
    send_password_reset_email,
    send_verification_email,
)
from ..models import User
from ..ratelimit import auth_rate_limit
from ..schemas import (
    EmailRequest,
    PasswordChange,
    ResetPassword,
    Token,
    TokenAction,
    UserCreate,
    UserOut,
    UserUpdate,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(auth_rate_limit)],
)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> Token:
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    user = User(
        email=payload.email.lower(),
        name=payload.name.strip(),
        hashed_password=hash_password(payload.password),
        starting_balance=payload.starting_balance,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    send_verification_email(user.email, user.id)

    token = create_access_token(user.id)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=Token, dependencies=[Depends(auth_rate_limit)])
def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
) -> Token:
    # OAuth2 form uses `username` for the email field.
    user = db.scalar(select(User).where(User.email == form_data.username.lower()))
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(user.id)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    if payload.name is not None:
        current_user.name = payload.name.strip()
    if payload.starting_balance is not None:
        current_user.starting_balance = payload.starting_balance
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Permanently delete the current user and all their data."""
    db.delete(current_user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------- Email verification ---------------------------
@router.post("/verify", response_model=UserOut)
def verify_email(payload: TokenAction, db: Session = Depends(get_db)) -> UserOut:
    user_id = read_token(payload.token, "verify")
    if not user_id:
        raise HTTPException(status_code=400, detail="This verification link is invalid or expired.")
    user = db.get(User, int(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")
    user.is_verified = True
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/verify/resend", status_code=status.HTTP_204_NO_CONTENT)
def resend_verification(
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_verified:
        send_verification_email(current_user.email, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------- Password reset ---------------------------
@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(auth_rate_limit)])
def forgot_password(payload: EmailRequest, db: Session = Depends(get_db)) -> dict:
    """Always returns 202 so we never reveal whether an email is registered."""
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user:
        send_password_reset_email(user.email, user.id)
    return {"detail": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password", response_model=Token, dependencies=[Depends(auth_rate_limit)])
def reset_password(payload: ResetPassword, db: Session = Depends(get_db)) -> Token:
    user_id = read_token(payload.token, "reset")
    if not user_id:
        raise HTTPException(status_code=400, detail="This reset link is invalid or expired.")
    user = db.get(User, int(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return Token(access_token=token, user=UserOut.model_validate(user))
