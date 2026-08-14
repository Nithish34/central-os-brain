import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.database import init_db, SessionLocal
from app.api.v1.endpoints.demo import reset_and_seed_db


def main():
    print("Initializing prototype database schemas...")
    init_db()
    db = SessionLocal()
    try:
        print("Seeding baseline enterprise dataset...")
        reset_and_seed_db(db)
        print("Database successfully initialized and seeded!")
    finally:
        db.close()


if __name__ == "__main__":
    main()
