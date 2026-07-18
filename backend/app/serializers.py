"""Helpers to convert ORM objects into API/dict representations with metrics."""

from __future__ import annotations

import json

from .calculations import compute_metrics
from .models import Trade


def parse_images(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        value = json.loads(raw)
        if isinstance(value, list):
            return [str(x) for x in value]
    except (ValueError, TypeError):
        pass
    return []


def trade_to_dict(trade: Trade) -> dict:
    """Serialize a Trade ORM object into a dict including derived metrics."""
    base = {
        "id": trade.id,
        "account_id": trade.account_id,
        "playbook_id": trade.playbook_id,
        "symbol": trade.symbol,
        "direction": trade.direction,
        "status": trade.status,
        "quantity": trade.quantity,
        "entry_price": trade.entry_price,
        "exit_price": trade.exit_price,
        "stop_loss": trade.stop_loss,
        "take_profit": trade.take_profit,
        "fees": trade.fees,
        "entry_date": trade.entry_date,
        "exit_date": trade.exit_date,
        "setup": trade.setup,
        "tags": trade.tags,
        "mistakes": trade.mistakes,
        "rating": trade.rating,
        "images": parse_images(trade.images),
        "notes": trade.notes,
        "created_at": trade.created_at,
        "updated_at": trade.updated_at,
    }
    metrics = compute_metrics(base)
    base.update(
        gross_pnl=metrics.gross_pnl,
        net_pnl=metrics.net_pnl,
        return_pct=metrics.return_pct,
        r_multiple=metrics.r_multiple,
        is_win=metrics.is_win,
        holding_period_hours=metrics.holding_period_hours,
    )
    return base
