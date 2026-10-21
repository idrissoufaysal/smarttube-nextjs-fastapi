from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def get_rate_limit_key(request: Request) -> str:
    """
    Identifie le client pour le rate limiting :
    - Utilise en priorité l'identifiant Clerk (en-tête 'x-clerk-user-id')
    - Sinon, retombe sur l'adresse IP distante du client
    """
    clerk_id = request.headers.get("x-clerk-user-id")
    if clerk_id:
        return f"user:{clerk_id}"
    return get_remote_address(request)


# Instance globale du Limiter
limiter = Limiter(key_func=get_rate_limit_key)
