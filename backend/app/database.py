"""Database engine and session management (SQLAlchemy 2.0)."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


def _normalize_db_url(url: str) -> str:
    """Normalize a database URL to a SQLAlchemy-compatible driver form.

    Managed hosts (Render, Heroku, Railway) expose Postgres URLs as
    ``postgres://`` or ``postgresql://``. SQLAlchemy 2.0 rejects the bare
    ``postgres://`` scheme, and we ship the psycopg (v3) driver, so we route
    both to ``postgresql+psycopg://``.
    """
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


DATABASE_URL = _normalize_db_url(settings.database_url)

# SQLite needs check_same_thread=False when used with FastAPI's threadpool.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _add_missing_columns() -> None:
    """Lightweight forward-only migration: add columns present on the models but
    missing from pre-existing tables.

    This lets the app evolve its schema on an existing database without a full
    migration tool. Only *additive*, nullable columns are handled (all new
    columns in this project are nullable), so no backfill/default is required.
    Runs for both SQLite and Postgres.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue  # brand-new tables are handled by create_all
        existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in existing_cols:
                continue
            col_type = column.type.compile(dialect=engine.dialect)
            ddl = f'ALTER TABLE {table.name} ADD COLUMN {column.name} {col_type}'
            with engine.begin() as conn:
                conn.execute(text(ddl))
                # Backfill existing rows for columns the model expects to be
                # non-null, using the model's scalar default, so pre-existing
                # rows don't read back as NULL.
                default = getattr(column.default, "arg", None)
                if not column.nullable and default is not None and not callable(default):
                    conn.execute(
                        text(f"UPDATE {table.name} SET {column.name} = :val WHERE {column.name} IS NULL"),
                        {"val": default},
                    )


def init_db() -> None:
    """Create all tables and apply additive column migrations. Called on startup."""
    # Import models so they are registered on the metadata before create_all.
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _add_missing_columns()
