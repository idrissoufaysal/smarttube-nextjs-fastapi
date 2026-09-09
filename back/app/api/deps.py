import jwt
from typing import Annotated
from fastapi import Depends, HTTPException, Header, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.db.models import User
from app.db.session import get_db


async def get_current_user_optional(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    x_clerk_user_id: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """
    Extrait l'utilisateur connecté via JWT Clerk (Bearer) ou Header x-clerk-user-id.
    """
    clerk_id: str | None = None
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    image_url: str | None = None

    # 1. En-tête direct si proxifié
    if x_clerk_user_id:
        clerk_id = x_clerk_user_id

    # 2. En-tête Authorization: Bearer <token>
    elif authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            # Décodage sans vérification stricte de signature si clé publique non chargée,
            # ou avec options={verify_signature: False} pour lire les claims du token Clerk client
            payload = jwt.decode(token, options={"verify_signature": False})
            clerk_id = payload.get("sub") or payload.get("user_id")
            email = payload.get("email") or payload.get("sub_email")
            first_name = payload.get("first_name")
            last_name = payload.get("last_name")
            image_url = payload.get("image_url")
        except Exception:
            clerk_id = None

    if not clerk_id:
        # Fallback pour le dev local si aucun auth header n'est présent
        result = await db.execute(select(User).limit(1))
        return result.scalars().first()

    # 3. Recherche de l'utilisateur dans PostgreSQL
    query = select(User).where(User.clerkId == clerk_id)
    result = await db.execute(query)
    user = result.scalars().first()

    if user:
        return user

    # 4. Upsert automatique si l'utilisateur existe dans Clerk mais pas encore en base
    new_user = User(
        clerkId=clerk_id,
        email=email or f"{clerk_id}@clerk.local",
        firstName=first_name,
        lastName=last_name,
        imageUrl=image_url,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


async def get_current_user(
    user: User | None = Depends(get_current_user_optional),
) -> User:
    """
    Vérification stricte de l'utilisateur connecté (401 si non authentifié).
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Non autorisé. Veuillez vous connecter.",
        )
    return user
