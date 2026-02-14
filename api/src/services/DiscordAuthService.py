import random
import string
from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlmodel import select
from starlette import status

from src.dto.dto_utilisateurs import DiscordLoginRequest
from src.enums.Roles import Roles
from src.models import User, LoginLog
from src.utils.db import SessionDep


EMAIL_CONFLICT_EXCEPTION = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail="Un compte avec cette adresse email existe déjà.",
)


class DiscordAuthService:
    """Service gérant l'authentification via Discord OAuth2.

    Responsabilités :
    - Recherche d'un utilisateur par son discord_id
    - Création automatique d'un compte si premier login Discord
    - Gestion des conflits email
    - Normalisation du username Discord en login compatible
    """

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
        discord_data: DiscordLoginRequest,
    ) -> User:
        """Trouve ou crée un utilisateur à partir des données Discord.

        Flow :
        1. Cherche par discord_id → si trouvé, retourne l'utilisateur existant
        2. Vérifie que l'email n'est pas déjà utilisé
        3. Si email libre → crée un nouveau compte Discord
        4. Si email pris → retourne une erreur 409 Conflict

        Raises:
            HTTPException 409: Si l'email est déjà utilisé par un autre compte
        """
        # 1. Recherche par discord_id (utilisateur Discord connu)
        existing_user = await cls.get_user_by_discord_id(
            session, discord_data.discord_id
        )
        if existing_user:
            # Mettre à jour les infos Discord (avatar, email éventuellement)
            existing_user.avatar_url = discord_data.avatar_url
            existing_user.set_last_login_date(datetime.now())
            login_log = LoginLog(user=existing_user)
            session.add(login_log)
            await session.commit()
            await session.refresh(existing_user)
            return existing_user

        # 2. Vérifier qu'il n'y a pas de conflit email
        sql = select(User).where(User.email == discord_data.email)
        result = await session.exec(sql)
        email_user = result.first()
        if email_user:
            raise EMAIL_CONFLICT_EXCEPTION

        # 3. Créer un nouveau compte Discord
        unique_login = await cls._generate_unique_login(
            session, discord_data.username
        )

        new_user = User(
            login=unique_login,
            email=discord_data.email,
            discord_id=discord_data.discord_id,
            avatar_url=discord_data.avatar_url,
            role=Roles.USER,
        )
        new_user.set_last_login_date(datetime.now())
        login_log = LoginLog(user=new_user)
        session.add(new_user)
        session.add(login_log)
        await session.commit()
        await session.refresh(new_user)
        return new_user
