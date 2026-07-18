#!/usr/bin/env bash
# Start the backend (port 8000) and the Vite dev server (port 5173) together.
# The Vite dev server proxies /api to the backend, so open http://localhost:5173
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Setting up backend"
cd "$ROOT/backend"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r requirements.txt
[ -f .env ] || cp .env.example .env

echo "==> Seeding demo data (idempotent)"
python -m app.seed || true

echo "==> Starting backend on :8000"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 &
BACK_PID=$!

echo "==> Setting up frontend"
cd "$ROOT/frontend"
[ -d node_modules ] || npm install

echo "==> Starting Vite dev server on :5173"
npm run dev &
FRONT_PID=$!

trap 'kill $BACK_PID $FRONT_PID 2>/dev/null || true' EXIT
echo ""
echo "CLT Trading Journal is running:"
echo "  Frontend  http://localhost:5173"
echo "  API docs  http://localhost:8000/docs"
echo "  Demo login: demo@clt.app / demo1234"
wait
