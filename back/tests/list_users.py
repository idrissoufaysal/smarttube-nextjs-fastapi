import asyncio
from sqlalchemy import text
from app.db.session import engine


async def show_users():
    async with engine.connect() as conn:
        res = await conn.execute(text('SELECT id, "clerkId", email, "firstName", "lastName" FROM "User";'))
        users = res.fetchall()
        print(f"\n--- UTILISATEURS EXISTANTS DANS VOTRE BASE ({len(users)}) ---")
        for u in users:
            print(f"ID UUID : {u[0]}")
            print(f"Clerk ID: {u[1]}")
            print(f"Email   : {u[2]}")
            print(f"Nom     : {u[3]} {u[4]}")
            print("-" * 50)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(show_users())
