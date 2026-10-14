from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

# Engine configuration with connection pooling
if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False,
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_pre_ping=settings.DB_POOL_PRE_PING,
        pool_recycle=settings.DB_POOL_RECYCLE,
        echo=False,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    # Helper to create tables directly if needed (e.g. in test fixtures or fallback)
    import app.models  # noqa: F401
    from sqlalchemy import text
    Base.metadata.create_all(bind=engine)
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE events ADD COLUMN IF NOT EXISTS metadata_json TEXT DEFAULT '{}' NOT NULL;"))
            conn.execute(text("ALTER TABLE conflicts ADD COLUMN IF NOT EXISTS dedup_hash VARCHAR(64);"))
            conn.execute(text("ALTER TABLE conflicts ADD COLUMN IF NOT EXISTS description TEXT;"))
            conn.execute(text("ALTER TABLE conflicts ADD COLUMN IF NOT EXISTS target_repo VARCHAR(255);"))
            conn.execute(text("ALTER TABLE conflicts ADD COLUMN IF NOT EXISTS target_file_path VARCHAR(500);"))
            conn.execute(text("ALTER TABLE conflicts ADD COLUMN IF NOT EXISTS recommended_diff TEXT;"))
            conn.execute(text("ALTER TABLE conflicts ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(64);"))
            conn.execute(text("ALTER TABLE conflicts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;"))
    except Exception:
        pass

