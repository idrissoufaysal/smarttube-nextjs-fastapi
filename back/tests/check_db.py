import asyncio
from sqlalchemy import text
from app.db.session import engine
from app.config.settings import settings


async def test_db():
    print(f"URL: {settings.async_database_url}")
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT current_database(), current_user, version();"))
            row = result.fetchone()
            print("\n[OK] CONNEXION REUSSIE A POSTGRESQL !")
            print(f"   Base de donnees : {row[0]}")
            print(f"   Utilisateur     : {row[1]}")
            print(f"   Version         : {row[2][:50]}...")

            v_res = await conn.execute(text('SELECT count(*) FROM "Video";'))
            print(f"   Nombre de videos en base : {v_res.scalar()}")
    except Exception as e:
        print(f"\n[ERREUR] : {e}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(test_db())
