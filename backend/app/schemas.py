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


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    name: str
    starting_balance: float
    is_verified: bool = False
    created_at: datetime

    @field_validator("is_verified", mode="before")
    @classmethod
    def _default_verified(cls, v):
        # Rows that predate the is_verified column read back as NULL on an
        # already-deployed database; treat that as unverified rather than error.
        return bool(v) if v is not None else False


class EmailRequest(BaseModel):
    email: EmailStr


class ResetPassword(BaseModel):
    token: str
    new_password: str = Field(min_length=6, max_length=128)


class TokenAction(BaseModel):
    token: str


class EmailRequest(BaseModel):
    email: EmailStr


class ResetPassword(BaseModel):
    token: str
    new_password: str = Field(min_length=6, max_length=128)


class TokenAction(BaseModel):
    token: str


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    starting_balance: float | None = Field(default=None, ge=0)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --------------------------- Accounts ---------------------------
class AccountBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    broker: str | None = Field(default=None, max_length=120)
    currency: str = Field(default="USD", max_length=8)
    starting_balance: float = Field(default=10000.0, ge=0)
    is_default: bool = False


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    broker: str | None = Field(default=None, max_length=120)
    currency: str | None = Field(default=None, max_length=8)
    starting_balance: float | None = Field(default=None, ge=0)
    is_default: bool | None = None


class AccountOut(AccountBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


# --------------------------- Playbooks ---------------------------
class PlaybookBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    rules: str | None = None


class PlaybookCreate(PlaybookBase):
    pass


class PlaybookUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    description: str | None = None
    rules: str | None = None


class PlaybookOut(PlaybookBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


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
    mistakes: str | None = Field(default=None, max_length=255)
    rating: int | None = Field(default=None, ge=1, le=5)
    images: list[str] = Field(default_factory=list)
    notes: str | None = None
    account_id: int | None = None
    playbook_id: int | None = None

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
    mistakes: str | None = Field(default=None, max_length=255)
    rating: int | None = Field(default=None, ge=1, le=5)
    images: list[str] | None = None
    notes: str | None = None
    account_id: int | None = None
    playbook_id: int | None = None

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


class ImportPreviewRow(BaseModel):
    row: int
    ok: bool
    error: str | None = None
    data: dict | None = None


class ImportResult(BaseModel):
    total: int
    valid: int
    invalid: int
    rows: list[ImportPreviewRow]
    imported: int = 0


# --------------------------- Goals ---------------------------
GoalMetric = Literal["net_pnl", "win_rate", "trades", "profit_factor"]
GoalPeriod = Literal["all_time", "monthly"]


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    metric: GoalMetric
    target: float
    period: GoalPeriod = "all_time"
    account_id: int | None = None


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    metric: GoalMetric | None = None
    target: float | None = None
    period: GoalPeriod | None = None
    account_id: int | None = None


class GoalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    metric: GoalMetric
    target: float
    period: GoalPeriod
    account_id: int | None
    created_at: datetime
    # computed
    current: float = 0.0
    progress_pct: float = 0.0
    achieved: bool = False


class Insight(BaseModel):
    key: str
    title: str
    detail: str
    sentiment: Literal["positive", "negative", "neutral"]
    metric: float | None = None


# --------------------------- Backtest / simulator ---------------------------
class BacktestRequest(BaseModel):
    account_id: int | None = None
    setups: list[str] = Field(default_factory=list)
    directions: list[Direction] = Field(default_factory=list)
    playbook_ids: list[int] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    weekdays: list[int] = Field(default_factory=list)  # 0=Mon … 6=Sun
    hold_buckets: list[str] = Field(default_factory=list)
    min_rating: int | None = Field(default=None, ge=1, le=5)
    exclude_mistakes: bool = False


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
