"""Application configuration loaded from environment variables.

All settings can be overridden via environment variables or a `.env` file
placed in the backend directory. Sensible defaults are provided so the app
runs out of the box for local development, while production deployments can
supply a real secret key and a Postgres/MySQL DATABASE_URL.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Core ---
    app_name: str = "CLT Trading Journal"
    environment: str = "development"  # development | production

    # --- Security ---
    # IMPORTANT: override SECRET_KEY in production with a long random value.
    secret_key: str = "dev-secret-change-me-in-production-please-use-a-random-value"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    algorithm: str = "HS256"

    # --- Database ---
    # Default: local SQLite file. For production set e.g.
    #   DATABASE_URL=postgresql+psycopg://user:pass@host/db
    database_url: str = "sqlite:///./clt_tj.db"

    # --- CORS ---
    # Comma-separated list of allowed origins for the SPA.
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
