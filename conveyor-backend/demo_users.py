# create_demo_users.py
import asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker
from app.database import async_session, init_db  # your existing imports
from app.models import User
import bcrypt

async def create_demo_users():
    await init_db()  # makes sure tables exist first

    async with async_session() as db:
        # Check which users already exist
        existing = await db.execute("SELECT username FROM users")
        existing_usernames = {row[0] for row in existing.fetchall()}

        demo_users = [
            ("admin1",       "admin123",       "admin"),
            ("supervisor1",  "supervisor123",  "supervisor"),
            ("operator1",    "operator123",    "operator"),
            ("technician1",  "tech123",        "technician"),
        ]

        for username, plain_password, role in demo_users:
            if username in existing_usernames:
                print(f"  {username} already exists")
                continue

            # Hash password (same as you use in your login)
            hashed = bcrypt.hashpw(plain_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            user = User(
                username=username,
                password_hash=hashed,
                role=role
            )
            db.add(user)
            print(f"  Created user: {username} ({role})")

        await db.commit()
        print("  All demo users created successfully!")

if __name__ == "__main__":
    asyncio.run(create_demo_users())