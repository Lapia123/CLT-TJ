"""Seed the database with a demo user, accounts, playbooks and sample trades.

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
from .models import Account, Goal, JournalEntry, Playbook, Trade, User

SYMBOLS = ["AAPL", "TSLA", "NVDA", "BTCUSD", "EURUSD", "SPY", "AMZN", "MSFT"]
SETUPS = ["Breakout", "Pullback", "Reversal", "Trend", "Range", "News"]
MISTAKES = ["", "", "Chased entry", "Moved stop", "Oversized", "FOMO"]
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

        main_acct = Account(
            user_id=user.id, name="Main Account", broker="Interactive Brokers",
            currency="USD", starting_balance=25000.0, is_default=True,
        )
        prop_acct = Account(
            user_id=user.id, name="Prop Firm", broker="FTMO",
            currency="USD", starting_balance=100000.0, is_default=False,
        )
        db.add_all([main_acct, prop_acct])

        playbooks = [
            Playbook(user_id=user.id, name="Breakout", description="Trade breakouts of key levels on volume.", rules="1. Level tested 2+ times\n2. Volume expansion\n3. Stop below level"),
            Playbook(user_id=user.id, name="Pullback", description="Buy pullbacks in an established trend.", rules="1. Higher highs/lows\n2. Pullback to MA\n3. Reversal candle"),
            Playbook(user_id=user.id, name="Reversal", description="Fade exhaustion at extremes.", rules="1. Extended move\n2. Divergence\n3. Confirmation"),
        ]
        db.add_all(playbooks)
        db.commit()
        for obj in [main_acct, prop_acct, *playbooks]:
            db.refresh(obj)

        rng = random.Random(42)
        base = datetime.now(timezone.utc) - timedelta(days=90)
        for i in range(60):
            symbol = rng.choice(SYMBOLS)
            direction = rng.choice(["long", "short"])
            entry = round(rng.uniform(50, 500), 2)
            qty = rng.choice([10, 25, 50, 100])
            entry_date = base + timedelta(days=i, hours=rng.randint(0, 6))
            account = rng.choice([main_acct, main_acct, prop_acct])
            pb = rng.choice(playbooks + [None])

            is_closed = rng.random() < 0.88
            if is_closed:
                move_pct = rng.uniform(-0.05, 0.065)
                exit_price = round(entry * (1 + move_pct) if direction == "long" else entry * (1 - move_pct), 2)
                exit_date = entry_date + timedelta(hours=rng.randint(1, 72))
                status = "closed"
            else:
                exit_price = None
                exit_date = None
                status = "open"
            stop = round(entry * (0.97 if direction == "long" else 1.03), 2)

            db.add(
                Trade(
                    user_id=user.id,
                    account_id=account.id,
                    playbook_id=pb.id if pb else None,
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
                    mistakes=rng.choice(MISTAKES),
                    rating=rng.randint(1, 5),
                    notes=rng.choice(["Clean entry", "Chased it", "Followed plan", ""]),
                )
            )

        db.add_all([
            Goal(user_id=user.id, name="Monthly net P&L", metric="net_pnl", target=3000, period="monthly"),
            Goal(user_id=user.id, name="Reach 60% win rate", metric="win_rate", target=60, period="all_time"),
            Goal(user_id=user.id, name="Log 100 trades", metric="trades", target=100, period="all_time"),
        ])
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
        print(f"Seeded demo user {DEMO_EMAIL} / {DEMO_PASSWORD}: 2 accounts, 3 playbooks, 3 goals, 60 trades.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
