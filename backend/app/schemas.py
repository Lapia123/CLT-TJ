"""Pydantic request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Direction = Literal["long", "short"]
Status = Literal["open", "closed"]


# --------------------------- Auth ---------------------------
class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=6, max_length=128)
    starting_balance: float = Field(default=10000.0, ge=0)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    name: str
    starting_balance: float
    created_at: datetime


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    starting_balance: float | None = Field(default=None, ge=0)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --------------------------- Trades ---------------------------
class TradeBase(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    direction: Direction
    quantity: float = Field(gt=0)
    entry_price: float = Field(gt=0)
    exit_price: float | None = Field(default=None, gt=0)
    stop_loss: float | None = Field(default=None, gt=0)
    take_profit: float | None = Field(default=None, gt=0)
    fees: float = Field(default=0.0, ge=0)
    entry_date: datetime
    exit_date: datetime | None = None
    setup: str | None = Field(default=None, max_length=64)
    tags: str | None = Field(default=None, max_length=255)
    notes: str | None = None

    @field_validator("symbol")
    @classmethod
    def upper_symbol(cls, v: str) -> str:
        return v.strip().upper()


class TradeCreate(TradeBase):
    status: Status = "open"


class TradeUpdate(BaseModel):
    symbol: str | None = Field(default=None, min_length=1, max_length=32)
    direction: Direction | None = None
    status: Status | None = None
    quantity: float | None = Field(default=None, gt=0)
    entry_price: float | None = Field(default=None, gt=0)
    exit_price: float | None = Field(default=None, gt=0)
    stop_loss: float | None = Field(default=None, gt=0)
    take_profit: float | None = Field(default=None, gt=0)
    fees: float | None = Field(default=None, ge=0)
    entry_date: datetime | None = None
    exit_date: datetime | None = None
    setup: str | None = Field(default=None, max_length=64)
    tags: str | None = Field(default=None, max_length=255)
    notes: str | None = None

    @field_validator("symbol")
    @classmethod
    def upper_symbol(cls, v: str | None) -> str | None:
        return v.strip().upper() if v else v


class TradeOut(TradeBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: Status
    created_at: datetime
    updated_at: datetime
    # Derived metrics (computed, not stored)
    gross_pnl: float | None = None
    net_pnl: float | None = None
    return_pct: float | None = None
    r_multiple: float | None = None
    is_win: bool | None = None
    holding_period_hours: float | None = None


# --------------------------- Journal ---------------------------
class JournalCreate(BaseModel):
    entry_date: datetime
    title: str = Field(min_length=1, max_length=200)
    content: str = ""
    mood: str | None = Field(default=None, max_length=32)


class JournalUpdate(BaseModel):
    entry_date: datetime | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = None
    mood: str | None = Field(default=None, max_length=32)


class JournalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    entry_date: datetime
    title: str
    content: str
    mood: str | None
    created_at: datetime
