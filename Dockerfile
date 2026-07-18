# --- Stage 1: build the React SPA ---
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Python API that serves the built SPA ---
FROM python:3.11-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENVIRONMENT=production

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
# Place the built SPA where main.py expects it (backend/static).
COPY --from=frontend /app/frontend/dist ./backend/static

WORKDIR /app/backend
EXPOSE 8000

# Single Uvicorn process serves both the API (/api/*) and the SPA.
# Bind to $PORT when the platform provides one (Render/Railway), else 8000.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
