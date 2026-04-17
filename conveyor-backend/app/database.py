 
# ============================================================
# database.py
# Handles the connection to PostgreSQL and table creation.
#
# Key concept — "async":
#   Normal code: Python asks DB a question → FREEZES and waits
#   Async code:  Python asks DB a question → does other work
#                while waiting → picks up answer when ready
#
#   This matters because our app receives ESP32 data every 5s
#   AND serves React at the same time. We can't afford to freeze.
# ============================================================

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy import text

from app.config import settings
from app.models import Base


# ── Engine ────────────────────────────────────────────────────
# The engine is the actual connection to PostgreSQL.
# Think of it as a phone line — the engine keeps it open.
#
# echo=False → don't print every SQL query to the console
#              (set to True if you want to see what SQL runs)
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
)


# ── Session factory ───────────────────────────────────────────
# A "session" is one conversation with the database.
# AsyncSessionLocal creates a new session whenever we need one.
# expire_on_commit=False → keep data accessible after saving
AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
)


# ── Dependency for API routes ─────────────────────────────────
# FastAPI calls this function automatically for every API request
# that needs the database. It:
#   1. Opens a session
#   2. Gives it to the route handler
#   3. Closes it when the request is done
#
# Usage in any router:
#   async def my_route(db: AsyncSession = Depends(get_db)):
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


# ── Database initialization ───────────────────────────────────
# Called ONCE when the app starts (in main.py).
# Creates all tables defined in models.py if they don't exist.
# Then sets up the TimescaleDB hypertable for sensor_readings.
async def init_db():
    async with engine.begin() as conn:

        # Create all tables from models.py
        # checkfirst=True → skip if table already exists
        await conn.run_sync(Base.metadata.create_all)
        print("[DB] All tables created (or already existed)")

        # ── TimescaleDB hypertable ────────────────────────────
        # What is a hypertable?
        #   A normal PostgreSQL table stores all rows together.
        #   A hypertable automatically splits rows into
        #   time-based "chunks" (e.g. one chunk per week).
        #
        #   Result: queries like "give me last 7 days of data"
        #   are 10-100x faster even with millions of rows.
        #
        # if_not_exists => TRUE → don't crash if already done
        try:
            await conn.execute(text("""
                SELECT create_hypertable(
                    'sensor_readings',
                    'timestamp',
                    if_not_exists => TRUE
                );
            """))
            print("[DB] TimescaleDB hypertable ready")

        except Exception as e:
            # This happens if TimescaleDB extension is not
            # installed yet — the app still works, just slower
            print(f"[DB] Hypertable skipped: {e}")
            print("[DB] Install TimescaleDB for better performance")