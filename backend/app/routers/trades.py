"""Trade CRUD, filtering, validation, and CSV import."""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Trade, User
from ..schemas import ImportPreviewRow, ImportResult, TradeCreate, TradeOut, TradeUpdate
from ..serializers import trade_to_dict

router = APIRouter(prefix="/api/trades", tags=["trades"])

# Columns accepted by the CSV importer (order is not significant).
CSV_COLUMNS = [
    "symbol",
    "direction",
    "status",
    "quantity",
    "entry_price",
    "exit_price",
    "stop_loss",
    "take_profit",
    "fees",
    "entry_date",
    "exit_date",
    "setup",
    "tags",
    "notes",
]


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


def _apply_payload(trade: Trade, data: dict) -> None:
    """Apply a payload dict to a Trade, encoding the images list as JSON."""
    if "images" in data:
        images = data.pop("images")
        trade.images = json.dumps(images) if images else None
    for key, value in data.items():
        setattr(trade, key, value)


@router.get("", response_model=list[TradeOut])
def list_trades(
    status_filter: str | None = Query(default=None, alias="status"),
    symbol: str | None = None,
    setup: str | None = None,
    direction: str | None = None,
    account_id: int | None = None,
    playbook_id: int | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = Query(default=1000, le=5000, ge=1),
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
    if account_id is not None:
        stmt = stmt.where(Trade.account_id == account_id)
    if playbook_id is not None:
        stmt = stmt.where(Trade.playbook_id == playbook_id)
    if start:
        stmt = stmt.where(Trade.entry_date >= start)
    if end:
        stmt = stmt.where(Trade.entry_date <= end)

    stmt = stmt.order_by(Trade.entry_date.desc()).limit(limit).offset(offset)
    return [trade_to_dict(t) for t in db.scalars(stmt).all()]


@router.post("", response_model=TradeOut, status_code=status.HTTP_201_CREATED)
def create_trade(
    payload: TradeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _validate_close(payload.status, payload.exit_price, payload.exit_date)
    trade = Trade(user_id=current_user.id)
    _apply_payload(trade, payload.model_dump())
    db.add(trade)
    db.commit()
    db.refresh(trade)
    return trade_to_dict(trade)


@router.get("/import/template", tags=["trades"])
def import_template():
    """Download a CSV template with the accepted columns and one example row."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(CSV_COLUMNS)
    writer.writerow(
        [
            "AAPL", "long", "closed", "100", "150.25", "155.10", "148.00", "160.00",
            "1.50", "2026-01-15 09:35", "2026-01-15 14:20", "Breakout", "A+", "Clean setup",
        ]
    )
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=clt_trades_template.csv"},
    )


def _parse_csv_row(raw: dict) -> dict:
    """Convert one CSV row (all strings) into a validated trade payload dict."""
    def num(key, required=False):
        val = (raw.get(key) or "").strip()
        if not val:
            if required:
                raise ValueError(f"{key} is required")
            return None
        return float(val)

    def dt(key, required=False):
        val = (raw.get(key) or "").strip()
        if not val:
            if required:
                raise ValueError(f"{key} is required")
            return None
        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d"):
            try:
                return datetime.strptime(val, fmt)
            except ValueError:
                continue
        raise ValueError(f"{key} has an unrecognized date format: '{val}'")

    symbol = (raw.get("symbol") or "").strip().upper()
    if not symbol:
        raise ValueError("symbol is required")
    direction = (raw.get("direction") or "").strip().lower()
    if direction not in ("long", "short"):
        raise ValueError("direction must be 'long' or 'short'")
    status_val = (raw.get("status") or "open").strip().lower()
    if status_val not in ("open", "closed"):
        raise ValueError("status must be 'open' or 'closed'")

    quantity = num("quantity", required=True)
    entry_price = num("entry_price", required=True)
    exit_price = num("exit_price")
    exit_date = dt("exit_date")

    if status_val == "closed" and exit_price is None:
        raise ValueError("closed trade requires exit_price")
    if status_val == "closed" and exit_date is None:
        raise ValueError("closed trade requires exit_date")
    if quantity <= 0 or entry_price <= 0:
        raise ValueError("quantity and entry_price must be positive")

    return {
        "symbol": symbol,
        "direction": direction,
        "status": status_val,
        "quantity": quantity,
        "entry_price": entry_price,
        "exit_price": exit_price,
        "stop_loss": num("stop_loss"),
        "take_profit": num("take_profit"),
        "fees": num("fees") or 0.0,
        "entry_date": dt("entry_date", required=True),
        "exit_date": exit_date,
        "setup": (raw.get("setup") or "").strip() or None,
        "tags": (raw.get("tags") or "").strip() or None,
        "notes": (raw.get("notes") or "").strip() or None,
    }


@router.post("/import", response_model=ImportResult)
async def import_trades(
    file: UploadFile,
    commit: bool = Query(default=False),
    account_id: int | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ImportResult:
    """Parse an uploaded CSV. With commit=false returns a validation preview;
    with commit=true inserts all valid rows."""
    content = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        raise HTTPException(status_code=422, detail="The CSV file appears to be empty.")

    rows: list[ImportPreviewRow] = []
    valid_payloads: list[dict] = []
    for i, raw in enumerate(reader, start=2):  # row 1 is the header
        try:
            payload = _parse_csv_row(raw)
            valid_payloads.append(payload)
            preview = {**payload}
            preview["entry_date"] = payload["entry_date"].isoformat() if payload["entry_date"] else None
            preview["exit_date"] = payload["exit_date"].isoformat() if payload["exit_date"] else None
            rows.append(ImportPreviewRow(row=i, ok=True, data=preview))
        except (ValueError, KeyError) as exc:
            rows.append(ImportPreviewRow(row=i, ok=False, error=str(exc)))

    imported = 0
    if commit and valid_payloads:
        for payload in valid_payloads:
            db.add(Trade(user_id=current_user.id, account_id=account_id, **payload))
        db.commit()
        imported = len(valid_payloads)

    return ImportResult(
        total=len(rows),
        valid=len(valid_payloads),
        invalid=len(rows) - len(valid_payloads),
        rows=rows,
        imported=imported,
    )


@router.get("/export", tags=["trades"])
def export_trades(
    account_id: int | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export the user's trades (optionally one account) as a CSV download."""
    stmt = select(Trade).where(Trade.user_id == current_user.id)
    if account_id is not None:
        stmt = stmt.where(Trade.account_id == account_id)
    stmt = stmt.order_by(Trade.entry_date.desc())

    cols = [
        "symbol", "direction", "status", "quantity", "entry_price", "exit_price",
        "stop_loss", "take_profit", "fees", "entry_date", "exit_date", "setup",
        "tags", "mistakes", "rating", "notes", "net_pnl", "return_pct", "r_multiple",
    ]
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(cols)
    for t in db.scalars(stmt).all():
        d = trade_to_dict(t)
        writer.writerow(
            [
                d["symbol"], d["direction"], d["status"], d["quantity"], d["entry_price"],
                d["exit_price"] or "", d["stop_loss"] or "", d["take_profit"] or "", d["fees"],
                d["entry_date"].isoformat() if d["entry_date"] else "",
                d["exit_date"].isoformat() if d["exit_date"] else "",
                d["setup"] or "", d["tags"] or "", d["mistakes"] or "", d["rating"] or "",
                (d["notes"] or "").replace("\n", " "),
                d["net_pnl"] if d["net_pnl"] is not None else "",
                d["return_pct"] if d["return_pct"] is not None else "",
                d["r_multiple"] if d["r_multiple"] is not None else "",
            ]
        )
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=clt_trades_export.csv"},
    )


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
    _apply_payload(trade, payload.model_dump(exclude_unset=True))
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
