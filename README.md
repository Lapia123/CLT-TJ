# CLT Trading Journal

A production-ready trading journal for logging trades and analyzing performance.
Record every trade, let the app compute your P&L, R-multiples, win rate and
profit factor, then review where your edge actually comes from.

![Stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20React-6366f1)

## Features

- **Accounts** — JWT authentication (register / login), per-user data isolation.
- **Trade log** — full CRUD for long/short, open/closed positions with entry/exit
  prices, stops, targets, fees, setup, tags and notes.
- **Automatic metrics** — gross & net P&L, return %, R-multiple, win/loss and
  holding period computed on the fly (rounded to 2 decimals, no ledger drift).
- **Dashboard** — net P&L, balance, win rate, profit factor, expectancy, average
  win/loss, best/worst trade, streaks, and an interactive equity curve.
- **Analytics** — performance broken down by symbol, setup, direction and weekday,
  plus a daily P&L calendar heatmap.
- **Journal** — dated notes with mood tagging for process review.
- **Settings** — profile and starting-balance (equity-curve baseline).

## Tech stack

| Layer     | Technology                                            |
| --------- | ----------------------------------------------------- |
| Frontend  | React 18, Vite, Tailwind CSS, Recharts, React Router  |
| Backend   | FastAPI, SQLAlchemy 2.0, Pydantic v2, Uvicorn         |
| Database  | SQLite by default; Postgres-ready via `DATABASE_URL`  |
| Auth      | JWT (python-jose) + bcrypt password hashing           |

## Quick start (development)

Requires Python 3.11+ and Node 18+.

```bash
./scripts/dev.sh
```

This sets up a virtualenv, installs dependencies, seeds a demo account, and
starts both servers. Then open **http://localhost:5173**.

**Demo login:** `demo@clt.app` / `demo1234`

### Manual setup

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed          # optional demo data
uvicorn app.main:app --reload   # http://localhost:8000  (docs at /docs)

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

## Production

Single-process deploy — the API serves the built SPA from `backend/static`:

```bash
docker build -t clt-tj .
docker run -p 8000:8000 \
  -e SECRET_KEY="$(python -c 'import secrets;print(secrets.token_urlsafe(48))')" \
  -e DATABASE_URL="postgresql+psycopg://user:pass@host/clt_tj" \
  clt-tj
```

Then browse **http://localhost:8000**.

Without Docker: run `npm run build` in `frontend/`, copy `frontend/dist` to
`backend/static`, set `ENVIRONMENT=production` + a real `SECRET_KEY`, and run
Uvicorn (behind a reverse proxy such as Nginx or Caddy).

### Production checklist

- [ ] Set a strong random `SECRET_KEY`.
- [ ] Set `ENVIRONMENT=production`.
- [ ] Use a managed Postgres via `DATABASE_URL` (SQLite is single-file, fine for
      small/single-user deployments).
- [ ] Restrict `CORS_ORIGINS` to your real frontend origin(s).
- [ ] Serve over HTTPS (terminate TLS at your reverse proxy).

## Configuration

All backend settings come from environment variables (see `backend/.env.example`):
`ENVIRONMENT`, `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `DATABASE_URL`,
`CORS_ORIGINS`. Frontend: `VITE_API_URL` (see `frontend/.env.example`).

## Tests

```bash
cd backend && source .venv/bin/activate && pytest
```

Covers the calculation engine (P&L, R-multiple, win rate, profit factor,
streaks) and the API (auth, trade CRUD, validation, user isolation, analytics).

## API overview

| Method | Endpoint                         | Description                    |
| ------ | -------------------------------- | ------------------------------ |
| POST   | `/api/auth/register`             | Create account, returns token  |
| POST   | `/api/auth/login`                | Login (OAuth2 form), returns token |
| GET    | `/api/auth/me`                   | Current user                   |
| GET/POST | `/api/trades`                  | List / create trades           |
| PATCH/DELETE | `/api/trades/{id}`         | Update / delete a trade        |
| GET    | `/api/analytics/summary`         | Portfolio statistics           |
| GET    | `/api/analytics/equity-curve`    | Cumulative equity points       |
| GET    | `/api/analytics/breakdown`       | Grouped performance            |
| GET    | `/api/analytics/calendar`        | Daily P&L                      |
| GET/POST | `/api/journal`                 | List / create journal entries  |

Interactive docs at `/docs` when the server is running.

## Project structure

```
clt-tj/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app, CORS, security headers, SPA hosting
│   │   ├── config.py         # env-driven settings
│   │   ├── database.py       # SQLAlchemy engine/session
│   │   ├── models.py         # User, Trade, JournalEntry
│   │   ├── schemas.py        # Pydantic schemas
│   │   ├── auth.py           # JWT + password hashing
│   │   ├── calculations.py   # pure metric calculations (unit-tested)
│   │   ├── serializers.py    # ORM -> dict with metrics
│   │   ├── seed.py           # demo data
│   │   └── routers/          # auth, trades, analytics, journal
│   └── tests/
├── frontend/
│   └── src/
│       ├── pages/            # Dashboard, Trades, Analytics, Journal, Settings, Login, Register
│       ├── components/       # Layout, TradeForm, charts, Modal, Toast, StatCard
│       ├── context/          # AuthContext
│       └── api/              # axios client
├── Dockerfile
└── scripts/dev.sh
```
