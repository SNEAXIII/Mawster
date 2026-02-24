# 🔐 Guide d'intégration Discord OAuth2 — Mawster

> **Date** : 2026-02-13  
> **Projet** : Mawster — Projet fil rouge CESI Ingénieur  
> **Stack** : Next.js 14 + NextAuth v5 β25 / FastAPI + PyJWT / MariaDB / Docker + Caddy

---

## Table des matières

1. [Architecture recommandée](#1️⃣-architecture-recommandée)
2. [Configuration Discord Developer Portal](#2️⃣-configuration-discord-developer-portal)
3. [Configuration NextAuth (Frontend)](#3️⃣-configuration-nextauth-frontend)
4. [Vérification JWT côté FastAPI (Backend)](#4️⃣-vérification-jwt-côté-fastapi-backend)
5. [Création automatique utilisateur en base](#5️⃣-création-automatique-utilisateur-en-base)
6. [Configuration Docker](#6️⃣-configuration-docker)
7. [Bonnes pratiques sécurité](#7️⃣-bonnes-pratiques-sécurité)
8. [Tests](#8️⃣-tests)
9. [Version production-ready](#9️⃣-version-production-ready)
10. [Analyse des risques OAuth](#🔎-analyse-des-risques-oauth)

---

## 1️⃣ Architecture recommandée

### Schéma du flow OAuth2 complet

```
┌──────────────┐         ┌───────────────┐         ┌──────────────────┐
│   Navigateur │         │  Next.js SSR  │         │   Discord API    │
│   (Client)   │         │  + NextAuth   │         │  (OAuth Server)  │
└──────┬───────┘         └──────┬────────┘         └────────┬─────────┘
       │                        │                           │
       │  1. Clic "Se connecter │                           │
       │     avec Discord"      │                           │
       │ ──────────────────────>│                           │
       │                        │                           │
       │                        │  2. Redirect vers Discord │
       │ <─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │     OAuth authorize URL   │
       │                        │                           │
       │  3. L'utilisateur      │                           │
       │     autorise l'app     │                           │
       │ ───────────────────────────────────────────────────>
       │                        │                           │
       │                        │  4. Discord redirige avec │
       │                        │     authorization_code    │
       │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ >│                           │
       │                        │                           │
       │                        │  5. NextAuth échange le   │
       │                        │     code contre un token  │
       │                        │ ─────────────────────────>│
       │                        │                           │
       │                        │  6. Discord retourne      │
       │                        │     access_token + profil │
       │                        │ <─────────────────────────│
       │                        │                           │
       │                        │                           │
       │                        │  ┌──────────────────────┐ │
       │                        │  │ 7. NextAuth envoie   │ │
       │                        │  │    le profil Discord │ │
       │                        │  │    au backend FastAPI│ │
       │                        │  └──────────┬───────────┘ │
       │                        │             │             │
       │                        │             ▼             │
       │                        │  ┌─────────────────────┐  │
       │                        │  │  FastAPI            │  │
       │                        │  │  POST /auth/discord │  │
       │                        │  │                     │  │
       │                        │  │  • Cherche user par │  │
       │                        │  │    discord_id       │  │
       │                        │  │  • Si absent → crée │  │
       │                        │  │  • Retourne JWT     │  │
       │                        │  │    backend signé    │  │
       │                        │  └──────────┬──────────┘  │
       │                        │             │             │
       │                        │ <───────────┘             │
       │                        │                           │
       │                        │  8. NextAuth crée un      │
       │                        │     JWT session (cookie   │
       │                        │     httpOnly + Secure)    │
       │                        │     contenant le JWT      │
       │                        │     backend               │
       │ <──────────────────────│                           │
       │   9. Cookie httpOnly   │                           │
       │      set-cookie        │                           │
       │                        │                           │
       │  10. Requêtes API      │                           │
       │      subséquentes      │                           │
       │ ──────────────────────>│                           │
       │   Cookie envoyé auto   │                           │
       │                        │  11. Next.js lit le JWT   │
       │                        │      backend du cookie    │
       │                        │      et l'envoie en       │
       │                        │      Authorization:       │
       │                        │      Bearer <token>       │
       │                        │ ────────────────────────> │
       │                        │              FastAPI      │
       │                        │              valide       │
       │                        │              le JWT       │
```

### Principes d'architecture

| Principe | Implémentation |
|----------|---------------|
| **Cookie httpOnly** | NextAuth stocke la session dans un cookie `httpOnly`, `Secure`, `SameSite=Lax` → JavaScript client n'y a jamais accès |
| **JWT backend signé** | FastAPI signe un JWT avec `SECRET_KEY` (HS256). C'est ce token qui est vérifié à chaque appel API |
| **Séparation des responsabilités** | NextAuth gère le flow OAuth + session. FastAPI gère l'autorisation + les données métier |
| **Pas de token Discord côté client** | Le `access_token` Discord ne quitte jamais le serveur Next.js (SSR). Le client ne voit que le cookie de session |
| **Création utilisateur transparente** | FastAPI crée le compte automatiquement au premier login Discord (upsert par `discord_id`) |

### Pourquoi cette architecture ?

1. **NextAuth gère l'OAuth** car il est côté serveur (SSR), il peut stocker le `client_secret` Discord en sécurité, et il gère nativement les redirections OAuth2.
2. **FastAPI valide un JWT maison** car il ne doit pas dépendre de Discord pour chaque requête API. Un JWT signé localement est vérifiable en $O(1)$ sans appel réseau.
3. **Le cookie httpOnly** est le mécanisme de transport le plus sûr pour une session web — il est immune aux attaques XSS (JavaScript ne peut pas le lire).

---

## 2️⃣ Configuration Discord Developer Portal

### Étape par étape

1. Aller sur **https://discord.com/developers/applications**
2. Cliquer **"New Application"** → nommer `Mawster`
3. Onglet **OAuth2** :
   - Copier le **Client ID** (public)
   - Copier le **Client Secret** (⚠️ ne jamais commiter)
   - Section **Redirects** → ajouter les URLs de callback :

```
# Développement
http://localhost:3000/api/auth/callback/discord

# Production (adapter le domaine)
https://votre-domaine.com/api/auth/callback/discord
```

4. Onglet **Bot** : **Ne pas créer de bot** — on n'en a pas besoin pour OAuth2

### Scopes minimums requis

| Scope | Raison | Données reçues |
|-------|--------|---------------|
| `identify` | Obligatoire — identité de base | `id`, `username`, `avatar`, `discriminator` |
| `email` | Récupérer l'email vérifié | `email`, `verified` |

⚠️ **Ne PAS ajouter** : `guilds`, `messages.read`, `bot` → principe du moindre privilège.

### Paramètres à ne JAMAIS exposer

| Paramètre | Où le stocker | Pourquoi |
|-----------|--------------|---------|
| `DISCORD_CLIENT_SECRET` | Variable d'environnement serveur uniquement | Si exposé, un attaquant peut usurper l'app Discord |
| `DISCORD_CLIENT_ID` | Variable d'environnement (peut être public) | Identifiant de l'app, non secret mais à ne pas hardcoder |
| `NEXTAUTH_SECRET` | Variable d'environnement serveur uniquement | Signe les cookies de session NextAuth |

### Risques sécurité spécifiques à Discord OAuth

| Risque | Description | Mitigation |
|--------|------------|-----------|
| **Token hijacking** | Vol du `access_token` Discord | Le token ne quitte jamais le serveur Next.js |
| **Open redirect** | Redirect URI manipulée | Discord valide la redirect URI exacte (whitelisted) |
| **CSRF sur le callback** | Forger une requête de callback | NextAuth inclut un `state` parameter (CSRF token) automatiquement |
| **Account takeover via email** | Un utilisateur change son email Discord pour cibler un compte existant | On lie les comptes par `discord_id`, pas par email |
| **Scope escalation** | Demander trop de permissions | On limite à `identify` + `email` |

---

## 3️⃣ Configuration NextAuth (Frontend)

### Variables d'environnement à ajouter

```env
# front.env (à ajouter aux variables existantes)
DISCORD_CLIENT_ID=votre_client_id_ici
DISCORD_CLIENT_SECRET=votre_client_secret_ici
NEXTAUTH_SECRET=REGENERER_UN_VRAI_SECRET_openssl_rand_base64_32
NEXTAUTH_URL=https://votre-domaine.com
```

### Provider Discord — Configuration NextAuth v5

Le provider Discord est ajouté **en parallèle** du provider Credentials existant. Les deux méthodes de connexion coexistent.

**Fichier modifié** : `front/app/api/auth/[...nextauth]/route.ts`

**Changements clés** :

```typescript
import Discord from 'next-auth/providers/discord';

// Ajouté dans le tableau providers[] aux côtés de Credentials
Discord({
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  authorization: {
    params: {
      scope: 'identify email',  // Scopes minimums
    },
  },
})
```

**Dans le callback `jwt`** — quand l'utilisateur se connecte via Discord :

1. NextAuth reçoit le profil Discord (`account.provider === 'discord'`)
2. Le serveur Next.js appelle `POST /auth/discord` sur FastAPI avec le `discord_id`, `email`, `username`
3. FastAPI retourne un JWT backend
4. Ce JWT est stocké dans le cookie de session NextAuth

**Points de sécurité critiques** :

| Point | Détail |
|-------|--------|
| **Strategy JWT** | `session: { strategy: 'jwt' }` — déjà configuré |
| **Signature** | HS256 via `NEXTAUTH_SECRET` pour le cookie. Le JWT backend utilise aussi HS256 via `SECRET_KEY` |
| **Cookie sécurisé** | NextAuth v5 configure automatiquement `httpOnly`, `Secure` (en HTTPS), `SameSite=Lax` |
| **HTTPS en prod** | Obligatoire pour que `Secure` fonctionne. Caddy doit servir en HTTPS |

### Pourquoi `SameSite=Lax` et pas `Strict` ?

`SameSite=Strict` bloquerait le cookie lors de la redirection OAuth (Discord → notre app), car c'est une navigation cross-site. `Lax` autorise le cookie pour les navigations top-level (GET), ce qui est nécessaire pour le callback OAuth.

---

## 4️⃣ Vérification JWT côté FastAPI (Backend)

### Nouveau endpoint : `POST /auth/discord`

Ce endpoint est appelé **par le serveur Next.js** (pas par le client). Il reçoit les informations Discord et retourne un JWT backend.

**Flow** :

```
Next.js (SSR) ──POST /auth/discord──> FastAPI
               {                         │
                 discord_id: "123...",    │ 1. Cherche user par discord_id
                 email: "user@...",      │ 2. Si absent → crée
                 username: "User#1234"   │ 3. Met à jour last_login
               }                         │ 4. Signe un JWT backend
                                         │
Next.js (SSR) <──{ access_token }────────┘
```

### Validation JWT existante (améliorée)

Le `JWTService.decode_jwt()` actuel n'attrape que `ExpiredSignatureError`. Pour la production, il faut aussi gérer :

- `InvalidSignatureError` — token falsifié
- `DecodeError` — token malformé
- `InvalidAlgorithmError` — attaque par changement d'algorithme (ex: `alg: none`)

### Gestion d'erreurs 401

Toutes les erreurs JWT retournent un `401 Unauthorized` avec un message clair mais non-révélateur :

| Erreur | Message retourné | Message interne (log) |
|--------|-----------------|----------------------|
| Token expiré | "Le token a expiré" | Log du `sub` + timestamp |
| Signature invalide | "Token invalide" | Log de l'IP source |
| Token malformé | "Token invalide" | Log du token tronqué |
| Rôle absent | "Token invalide" | Log du payload |

---

## 5️⃣ Création automatique utilisateur en base

### Modification du modèle `User`

Nouveaux champs ajoutés au modèle existant :

| Champ | Type | Description |
|-------|------|------------|
| `discord_id` | `Optional[str]` | ID Discord unique (ex: `"123456789012345678"`) |
| `auth_provider` | `AuthProvider` (enum) | `"local"` ou `"discord"` — méthode d'inscription |
| `avatar_url` | `Optional[str]` | URL de l'avatar Discord |

**Le champ `hashed_password` devient `Optional`** car les utilisateurs Discord n'ont pas de mot de passe local.

### Stratégie de liaison des comptes

```
POST /auth/discord reçoit { discord_id, email, username }
         │
         ▼
    discord_id existe en base ?
         │
    ┌────┴────┐
    │  OUI    │  NON
    ▼         ▼
  Login    email existe en base ?
  normal        │
         ┌──────┴──────┐
         │  OUI        │  NON
         ▼             ▼
    ❌ ERREUR       Créer un
    409 Conflict    nouveau compte
    "Un compte      avec discord_id
     existe déjà    + email + username
     avec cet       + auth_provider=discord
     email"         + hashed_password=None
```

### Pourquoi ne pas fusionner automatiquement par email ?

**Risque de sécurité critique** : un attaquant pourrait :
1. Créer un compte Discord avec l'email `victim@email.com`
2. Se connecter via Discord OAuth
3. Si on fusionne par email → l'attaquant prend le contrôle du compte de la victime

**Solution** : on lie par `discord_id` uniquement. Si l'email est déjà pris par un compte local, on retourne une erreur 409 et on propose à l'utilisateur de lier manuellement les comptes (fonctionnalité future).

### Gestion des collisions de login

Discord permet des usernames qui ne respectent pas notre règle `isalnum()` (4-15 chars). On génère un login compatible :

```python
# Stratégie de normalisation
discord_username = "My.User-Name!"
normalized = "".join(c for c in discord_username if c.isalnum())[:15]  # "MyUserName"
# Si collision → ajouter un suffixe aléatoire
# "MyUserName" → "MyUserName42"
```

---

## 6️⃣ Configuration Docker

### Variables d'environnement à injecter

**Fichier `front.env`** (à créer, PAS commité) :

```env
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=https://votre-domaine.com
DISCORD_CLIENT_ID=<depuis Discord Developer Portal>
DISCORD_CLIENT_SECRET=<depuis Discord Developer Portal>
```

**Fichier `api.env`** (existant, ajouter) :

```env
# Rien à ajouter côté API pour Discord
# Le JWT backend est déjà configuré via SECRET_KEY
```

### Règles de sécurité Docker

| Règle | Implémentation |
|-------|---------------|
| Pas de secret dans l'image | Les Dockerfiles ne contiennent aucune variable sensible |
| Injection au runtime | Via `env_file:` dans compose.yaml |
| Fichiers `.env` exclus de Git | `.gitignore` : `*.env` ✅ (déjà en place) |
| Fichiers `.env.example` sans vrais secrets | Remplacer par des placeholders |

### Fichier `front.env.example` recommandé

```env
NEXTAUTH_SECRET=GENERATE_WITH_openssl_rand_base64_32
NEXTAUTH_URL=https://votre-domaine.com
DISCORD_CLIENT_ID=PASTE_FROM_DISCORD_DEVELOPER_PORTAL
DISCORD_CLIENT_SECRET=PASTE_FROM_DISCORD_DEVELOPER_PORTAL
```

---

## 7️⃣ Bonnes pratiques sécurité

### Pourquoi éviter `localStorage` ?

| Critère | `localStorage` | Cookie `httpOnly` |
|---------|---------------|-------------------|
| Accessible par JS | ✅ Oui → XSS peut voler le token | ❌ Non → immune au XSS |
| Envoyé auto avec les requêtes | ❌ Non → doit être ajouté manuellement | ✅ Oui → envoyé automatiquement |
| Taille max | ~5MB | ~4KB |
| Persiste après fermeture | ✅ Oui (indéfiniment) | Configurable (expiration) |
| **Recommandation sécurité** | ❌ Ne JAMAIS stocker de tokens | ✅ Recommandé pour les sessions |

### Pourquoi `httpOnly` est essentiel ?

Un cookie `httpOnly` ne peut **pas** être lu par `document.cookie` en JavaScript. Même si une faille XSS existe (ex: `dangerouslySetInnerHTML` dans les articles), l'attaquant ne peut pas voler le cookie de session.

### Protection CSRF

| Mécanisme | Implémentation |
|-----------|---------------|
| `SameSite=Lax` | Bloque les requêtes cross-origin sauf navigations GET |
| CSRF token NextAuth | NextAuth v5 inclut automatiquement un token CSRF dans ses formulaires |
| Bearer token API | Les requêtes API utilisent un header `Authorization: Bearer`, non soumis au CSRF |

### CORS — Configuration correcte

**Actuellement** : `allow_origins=["*"]` avec `allow_credentials=True` ← **DANGEREUX**

**Recommandé** :

```python
# En production
origins = [
    "https://votre-domaine.com",
    "https://www.votre-domaine.com",
]

# En développement
if not IS_PROD:
    origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

### Rate limiting recommandé

| Endpoint | Limite recommandée | Raison |
|----------|-------------------|--------|
| `POST /auth/login` | 5 req/min/IP | Anti brute-force |
| `POST /auth/register` | 3 req/min/IP | Anti spam comptes |
| `POST /auth/discord` | 10 req/min/IP | Anti abuse OAuth |
| Routes publiques | 60 req/min/IP | Anti DoS |

Implémentation : `slowapi` (Python) ou directives `rate_limit` dans Caddy.

### Rotation des secrets

| Secret | Fréquence recommandée | Impact de la rotation |
|--------|----------------------|----------------------|
| `NEXTAUTH_SECRET` | Tous les 90 jours | Invalide toutes les sessions actives |
| `SECRET_KEY` (API) | Tous les 90 jours | Invalide tous les JWT backend |
| `DISCORD_CLIENT_SECRET` | Si compromis uniquement | Doit être régénéré dans Discord Dev Portal |
| `MARIADB_PASSWORD` | Tous les 180 jours | Nécessite redémarrage des services |

### Sécurisation Caddy

```caddyfile
# Configuration PRODUCTION recommandée
votre-domaine.com {
    # HTTPS automatique via Let's Encrypt (comportement par défaut de Caddy)
    
    # Headers de sécurité
    header {
        X-Frame-Options DENY
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        -Server
    }
    
    handle_path /api/back/* {
        reverse_proxy api:8000
    }
    
    # ⚠️ Retirer phpMyAdmin en production
    # handle_path /phpmyadmin/* { ... }
    
    handle {
        reverse_proxy front:3000
    }
}
```

---

## 8️⃣ Tests

### Mock Discord OAuth (test d'intégration)

Pour tester le flow sans appeler Discord :

```python
# tests/integration/test_discord_oauth.py
import pytest
from unittest.mock import AsyncMock

@pytest.fixture
def mock_discord_profile():
    """Simule le profil retourné par Discord"""
    return {
        "discord_id": "123456789012345678",
        "email": "testuser@discord.com",
        "username": "TestUser",
        "avatar_url": "https://cdn.discordapp.com/avatars/123/abc.png"
    }

@pytest.mark.asyncio
async def test_discord_login_creates_user(client, session, mock_discord_profile):
    """Premier login Discord → crée un utilisateur"""
    response = await client.post("/auth/discord", json=mock_discord_profile)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

@pytest.mark.asyncio
async def test_discord_login_existing_user(client, session, mock_discord_profile):
    """Deuxième login Discord → retrouve l'utilisateur existant"""
    # Premier login
    await client.post("/auth/discord", json=mock_discord_profile)
    # Deuxième login
    response = await client.post("/auth/discord", json=mock_discord_profile)
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_discord_login_email_conflict(client, session, mock_discord_profile):
    """Login Discord avec email déjà utilisé par un compte local → 409"""
    # Créer un compte local avec le même email
    await client.post("/auth/register", json={
        "login": "localuser",
        "email": "testuser@discord.com",
        "password": "SecurePass1!",
        "confirm_password": "SecurePass1!"
    })
    # Tenter un login Discord avec le même email
    response = await client.post("/auth/discord", json=mock_discord_profile)
    assert response.status_code == 409
```

### Test validation JWT

```python
# tests/unit/test_jwt_service.py
import pytest
import jwt as pyjwt
from src.services.JWTService import JWTService
from src.security.secrets import SECRET

def test_decode_valid_token():
    """Un token valide est décodé correctement"""
    token = JWTService.create_token(
        data={"sub": "testuser", "role": "user", "user_id": "123"},
        expires_delta=timedelta(minutes=60)
    )
    result = JWTService.decode_jwt(token)
    assert result["sub"] == "testuser"

def test_decode_expired_token():
    """Un token expiré lève EXPIRED_EXCEPTION"""
    token = JWTService.create_token(
        data={"sub": "testuser", "role": "user", "user_id": "123"},
        expires_delta=timedelta(minutes=-1)
    )
    with pytest.raises(Exception) as exc_info:
        JWTService.decode_jwt(token)
    assert exc_info.value.status_code == 401

def test_decode_invalid_signature():
    """Un token avec mauvaise signature lève CREDENTIALS_EXCEPTION"""
    token = pyjwt.encode(
        {"sub": "testuser", "role": "user"},
        "wrong-secret-key",
        algorithm="HS256"
    )
    with pytest.raises(Exception) as exc_info:
        JWTService.decode_jwt(token)
    assert exc_info.value.status_code == 401

def test_decode_algorithm_none_attack():
    """Un token avec alg=none est rejeté"""
    token = pyjwt.encode(
        {"sub": "testuser", "role": "admin"},
        "",
        algorithm="HS256"  # PyJWT refuse alg=none par défaut
    )
    # Forger manuellement un token alg=none
    import base64, json
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none"}).encode()).rstrip(b"=")
    payload = base64.urlsafe_b64encode(json.dumps({"sub": "hacker", "role": "admin"}).encode()).rstrip(b"=")
    forged = f"{header.decode()}.{payload.decode()}."
    with pytest.raises(Exception):
        JWTService.decode_jwt(forged)
```

### Test création utilisateur automatique

```python
# tests/unit/test_discord_user_service.py
import pytest
from src.services.DiscordAuthService import DiscordAuthService

@pytest.mark.asyncio
async def test_get_or_create_discord_user_new(session):
    """Crée un nouvel utilisateur Discord"""
    user = await DiscordAuthService.get_or_create_discord_user(
        session,
        discord_id="999888777",
        email="new@discord.com",
        username="NewUser"
    )
    assert user.discord_id == "999888777"
    assert user.auth_provider == "discord"
    assert user.hashed_password is None
    assert user.login.startswith("NewUser")

@pytest.mark.asyncio
async def test_get_or_create_discord_user_existing(session):
    """Retrouve un utilisateur Discord existant"""
    # Premier appel → crée
    user1 = await DiscordAuthService.get_or_create_discord_user(
        session, discord_id="999888777",
        email="existing@discord.com", username="User"
    )
    # Deuxième appel → retrouve
    user2 = await DiscordAuthService.get_or_create_discord_user(
        session, discord_id="999888777",
        email="existing@discord.com", username="User"
    )
    assert user1.id == user2.id

@pytest.mark.asyncio
async def test_normalized_login_from_discord_username(session):
    """Le username Discord est normalisé pour respecter les contraintes"""
    user = await DiscordAuthService.get_or_create_discord_user(
        session, discord_id="111222333",
        email="special@discord.com", username="My.User-Name!@#"
    )
    assert user.login.isalnum()
    assert 4 <= len(user.login) <= 15
```

---

## 9️⃣ Version production-ready

### Checklist de déploiement

| # | Vérification | Statut |
|---|-------------|--------|
| 1 | `NEXTAUTH_SECRET` unique et fort (≥ 32 bytes) | ☐ |
| 2 | `NEXTAUTH_URL` en `https://` | ☐ |
| 3 | `DISCORD_CLIENT_SECRET` injecté via `env_file`, jamais dans le code | ☐ |
| 4 | `SECRET_KEY` (API) unique et fort (≥ 64 hex chars) | ☐ |
| 5 | Caddy configuré avec HTTPS (supprimer `auto_https off`) | ☐ |
| 6 | CORS restreint aux domaines autorisés | ☐ |
| 7 | phpMyAdmin retiré du compose de production | ☐ |
| 8 | Redirect URI Discord configurée en HTTPS | ☐ |
| 9 | Cookie `Secure` activé (automatique avec HTTPS) | ☐ |
| 10 | Rate limiting en place | ☐ |
| 11 | Logs de production sans données sensibles | ☐ |
| 12 | Images Docker avec versions fixées | ☐ |

### Architecture sous-domaines (recommandée)

```
votre-domaine.com          → Front Next.js
api.votre-domaine.com      → FastAPI backend
```

**Avantages** :
- Isolation des cookies (un cookie front ne sera pas envoyé à l'API)
- CORS explicite et clair
- Possibilité de scaler indépendamment

**Caddyfile pour sous-domaines** :

```caddyfile
votre-domaine.com {
    reverse_proxy front:3000
}

api.votre-domaine.com {
    header Access-Control-Allow-Origin "https://votre-domaine.com"
    reverse_proxy api:8000
}
```

---

## 🔎 Analyse des risques OAuth

### Matrice des risques

| Risque | Probabilité | Impact | Niveau | Mitigation |
|--------|------------|--------|--------|-----------|
| Vol du `DISCORD_CLIENT_SECRET` | Faible | Critique | 🔴 | Variable d'env, rotation si compromis |
| Usurpation de session via cookie | Faible | Critique | 🔴 | `httpOnly` + `Secure` + `SameSite` |
| Compte Discord compromis → accès app | Moyenne | Haute | 🟠 | Pas de mitigation directe (responsabilité Discord) |
| MITM sur le callback OAuth | Faible | Haute | 🟠 | HTTPS obligatoire |
| Account takeover via email Discord | Moyenne | Haute | 🟠 | Liaison par `discord_id`, pas par email |
| CSRF sur le flow OAuth | Faible | Moyenne | 🟡 | `state` parameter (automatique NextAuth) |
| Énumération d'utilisateurs Discord | Faible | Basse | 🟢 | Messages d'erreur génériques |
| Scope escalation Discord | Très faible | Moyenne | 🟢 | Scopes minimums (`identify email`) |

### Comparaison sécurité : Credentials vs Discord OAuth

| Critère | Credentials (actuel) | Discord OAuth (nouveau) |
|---------|---------------------|------------------------|
| Stockage mot de passe | bcrypt en base ✅ | Pas de mot de passe ✅✅ |
| Brute-force | Possible sans rate limiting ⚠️ | Impossible (Discord gère) ✅ |
| Phishing | Risque modéré | Risque réduit (redirect URI fixe) |
| 2FA | Non implémenté ⚠️ | Délégué à Discord (si activé) ✅ |
| Réinitialisation MDP | À implémenter | Non applicable |
| Dépendance externe | Aucune ✅ | Discord API doit être accessible ⚠️ |

---

## 📁 Fichiers modifiés / créés

### Backend (API)

| Fichier | Action | Description |
|---------|--------|------------|
| `api/src/models/User.py` | Modifié | Ajout `discord_id`, `auth_provider`, `avatar_url`, `hashed_password` → Optional |
| `api/src/enums/AuthProvider.py` | Créé | Enum `LOCAL` / `DISCORD` |
| `api/src/services/DiscordAuthService.py` | Créé | Logique get_or_create + normalisation login |
| `api/src/controllers/auth_controller.py` | Modifié | Ajout endpoint `POST /auth/discord` |
| `api/src/dto/dto_utilisateurs.py` | Modifié | Ajout DTOs Discord |
| `api/src/services/JWTService.py` | Modifié | Gestion erreurs JWT complète |
| `api/migrations/versions/xxx_add_discord_fields.py` | Créé | Migration Alembic |

### Frontend

| Fichier | Action | Description |
|---------|--------|------------|
| `front/app/api/auth/[...nextauth]/route.ts` | Modifié | Ajout provider Discord |
| `front/app/types/next-auth.d.ts` | Modifié | Types étendus |
| `front/app/login/page.tsx` | Modifié | Bouton "Se connecter avec Discord" |
| `front/.env.dev.example` | Modifié | Variables Discord ajoutées |
| `front/.env.prod.example` | Modifié | Variables Discord ajoutées |
