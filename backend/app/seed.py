"""Seed the database with a demo user and sample trades.

Run with:  python -m app.seed
Creates demo@clt.app / demo1234 with a spread of realistic trades so the
dashboard and analytics are populated for evaluation.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from .auth import hash_password
from .database import SessionLocal, init_db
from .models import JournalEntry, Trade, User

SYMBOLS = ["AAPL", "TSLA", "NVDA", "BTCUSD", "EURUSD", "SPY", "AMZN", "MSFT"]
SETUPS = ["Breakout", "Pullback", "Reversal", "Trend", "Range", "News"]
DEMO_EMAIL = "demo@clt.app"
DEMO_PASSWORD = "demo1234"


def seed() -> None:
    init_db()
    db = SessionLocal()
    try:
        existing = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        if existing:
            print(f"Demo user already exists (id={existing.id}). Skipping.")
            return

        user = User(
            email=DEMO_EMAIL,
            name="Demo Trader",
            hashed_password=hash_password(DEMO_PASSWORD),
            starting_balance=25000.0,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        rng = random.Random(42)
        base = datetime.now(timezone.utc) - timedelta(days=90)
        for i in range(60):
            symbol = rng.choice(SYMBOLS)
            direction = rng.choice(["long", "short"])
            entry = round(rng.uniform(50, 500), 2)
            qty = rng.choice([10, 25, 50, 100])
            entry_date = base + timedelta(days=i, hours=rng.randint(0, 6))

            # 88% of trades are closed; skew slightly profitable.
            is_closed = rng.random() < 0.88
            if is_closed:
                move_pct = rng.uniform(-0.05, 0.065)
                if direction == "long":
                    exit_price = round(entry * (1 + move_pct), 2)
                else:
                    exit_price = round(entry * (1 - move_pct), 2)
                exit_date = entry_date + timedelta(hours=rng.randint(1, 72))
                status = "closed"
                stop = round(entry * (0.97 if direction == "long" else 1.03), 2)
            else:
                exit_price = None
                exit_date = None
                status = "open"
                stop = round(entry * (0.97 if direction == "long" else 1.03), 2)

            db.add(
                Trade(
                    user_id=user.id,
                    symbol=symbol,
                    direction=direction,
                    status=status,
                    quantity=qty,
                    entry_price=entry,
                    exit_price=exit_price,
                    stop_loss=stop,
                    fees=round(rng.uniform(0, 5), 2),
                    entry_date=entry_date,
                    exit_date=exit_date,
                    setup=rng.choice(SETUPS),
                    tags=rng.choice(["", "A+", "watchlist", "mistake"]),
                    notes=rng.choice(["Clean entry", "Chased it", "Followed plan", ""]),
                )
            )

        db.add(
            JournalEntry(
                user_id=user.id,
                entry_date=datetime.now(timezone.utc),
                title="Week in review",
                content="Discipline held up. Cut losers faster than last month.",
                mood="confident",
            )
        )
        db.commit()
        print(f"Seeded demo user {DEMO_EMAIL} / {DEMO_PASSWORD} with 60 trades.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
