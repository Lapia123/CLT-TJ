"""CLT Trading Journal — FastAPI application entrypoint.

Serves the JSON API under /api and, in production, the built React SPA from
the ../static directory (single-process deploy).
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import init_db
from .routers import analytics, auth, journal, trades

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("clt-tj")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s (%s)", settings.app_name, settings.environment)
    init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="A trading journal to log trades and analyze performance.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.get("/api/health", tags=["health"])
def health() -> dict:
    return {"status": "ok", "app": settings.app_name, "version": "1.0.0"}


app.include_router(auth.router)
app.include_router(trades.router)
app.include_router(analytics.router)
app.include_router(journal.router)


# ---------------------------------------------------------------------------
# Static SPA hosting (production single-process deploy).
# When a production build exists at backend/static, serve it and fall back to
# index.html for client-side routes. In dev the SPA runs via the Vite server.
# ---------------------------------------------------------------------------
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # Never let the SPA fallback swallow unknown API routes.
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
