import random
import string
from datetime import datetime
from typing import Optional

import httpx
from fastapi import HTTPException
from sqlmodel import select
from starlette import status

from src.dto.dto_utilisateurs import DiscordLoginRequest
from src.enums.Roles import Roles
from src.models import User, LoginLog
from src.utils.db import SessionDep

DISCORD_API_URL = "https://discord.com/api/v10"

EMAIL_CONFLICT_EXCEPTION = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail="Un compte avec cette adresse email existe deja.",
)

DISCORD_TOKEN_INVALID_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Le token Discord est invalide ou expire.",
)

DISCORD_API_ERROR_EXCEPTION = HTTPException(
    status_code=status.HTTP_502_BAD_GATEWAY,
    detail="Impossible de verifier le token aupres de Discord.",
)


class DiscordAuthService:
    """Service gerant l'authentification via Discord OAuth2.

    Responsabilites :
    - Verification du token d'acces Discord aupres de l'API Discord
    - Recherche d'un utilisateur par son discord_id
    - Creation automatique d'un compte si premier login Discord
    - Gestion des conflits email
    - Normalisation du username Discord en login compatible
    """

    @classmethod
    async def verify_discord_token(cls, access_token: str) -> dict:
        """Verifie le token d'acces Discord en appelant l'API Discord /users/@me.

        Returns:
            dict avec les cles : id, username, email, avatar (brutes depuis Discord)

        Raises:
            HTTPException 401: Token invalide ou expire
            HTTPException 502: Erreur de communication avec Discord
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{DISCORD_API_URL}/users/@me",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
        except httpx.RequestError:
            raise DISCORD_API_ERROR_EXCEPTION

        if response.status_code == 401:
            raise DISCORD_TOKEN_INVALID_EXCEPTION
        if response.status_code != 200:
            raise DISCORD_API_ERROR_EXCEPTION

        return response.json()

    @classmethod
    async def get_user_by_discord_id(
        cls, session: SessionDep, discord_id: str
    ) -> Optional[User]:
        """Recherche un utilisateur par son identifiant Discord."""
        sql = select(User).where(User.discord_id == discord_id)
        result = await session.exec(sql)
        return result.first()

    @classmethod
    def _normalize_login(cls, discord_username: str) -> str:
        """Normalise un username Discord pour respecter les contraintes du modèle.

        Règles :
        - Uniquement alphanumérique
        - Entre 4 et 15 caractères
        - Suffixe aléatoire si trop court après nettoyage
        """
        normalized = "".join(c for c in discord_username if c.isalnum())
        if len(normalized) < 4:
            suffix = "".join(random.choices(string.digits, k=4))
            normalized = f"{normalized}{suffix}"
        return normalized[:15]

    @classmethod
    async def _generate_unique_login(
        cls, session: SessionDep, discord_username: str
    ) -> str:
        """Génère un login unique à partir du username Discord.

        Si le login normalisé est déjà pris, ajoute un suffixe numérique aléatoire.
        """
        base_login = cls._normalize_login(discord_username)
        login = base_login

        # Vérifier l'unicité, ajouter un suffixe si nécessaire
        for _ in range(10):
            sql = select(User).where(User.login == login)
            result = await session.exec(sql)
            if result.first() is None:
                return login
            suffix = "".join(random.choices(string.digits, k=3))
            login = f"{base_login[:12]}{suffix}"

        # Fallback avec un identifiant aléatoire complet
        return f"user{''.join(random.choices(string.ascii_lowercase + string.digits, k=10))}"

    @classmethod
    async def get_or_create_discord_user(
        cls,
        session: SessionDep,
        discord_profile: dict,
    ) -> User:
        """Trouve ou cree un utilisateur a partir du profil Discord verifie.

        Args:
            discord_profile: Profil brut retourne par Discord API /users/@me

        Flow :
        1. Cherche par discord_id -> si trouve, retourne l'utilisateur existant
        2. Verifie que l'email n'est pas deja utilise
        3. Si email libre -> cree un nouveau compte Discord
        4. Si email pris -> retourne une erreur 409 Conflict

        Raises:
            HTTPException 409: Si l'email est deja utilise par un autre compte
        """
        discord_id = str(discord_profile["id"])
        email = discord_profile.get("email") or f"{discord_id}@discord.placeholder"
        username = discord_profile.get("username") or discord_profile.get("global_name") or f"discord_{discord_id}"
        avatar_hash = discord_profile.get("avatar")
        avatar_url = (
            f"https://cdn.discordapp.com/avatars/{discord_id}/{avatar_hash}.png"
            if avatar_hash
            else None
        )

        # 1. Recherche par discord_id (utilisateur Discord connu)
        existing_user = await cls.get_user_by_discord_id(session, discord_id)
        if existing_user:
            # Mettre a jour les infos Discord (avatar, email eventuellement)
            existing_user.avatar_url = avatar_url
            existing_user.set_last_login_date(datetime.now())
            login_log = LoginLog(user=existing_user)
            session.add(login_log)
            await session.commit()
            await session.refresh(existing_user)
            return existing_user

        # 2. Verifier qu'il n'y a pas de conflit email
        sql = select(User).where(User.email == email)
        result = await session.exec(sql)
        email_user = result.first()
        if email_user:
            raise EMAIL_CONFLICT_EXCEPTION

        # 3. Creer un nouveau compte Discord
        unique_login = await cls._generate_unique_login(
            session, username
        )

        new_user = User(
            login=unique_login,
            email=email,
            discord_id=discord_id,
            avatar_url=avatar_url,
            role=Roles.USER,
        )
        new_user.set_last_login_date(datetime.now())
        login_log = LoginLog(user=new_user)
        session.add(new_user)
        session.add(login_log)
        await session.commit()
        await session.refresh(new_user)
        return new_user
