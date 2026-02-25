# Audit de Sécurité — Mawster

**Date** : 25 février 2026  
**Périmètre** : API FastAPI, Frontend Next.js, Infrastructure Docker/Caddy, Base de données MariaDB

---

## Résumé

| Sévérité | Nombre | Corrigé |
|----------|--------|---------|
| Critique | 2 | ❌ |
| Haute | 5 | ❌ |
| Moyenne | 6 | ❌ |
| Basse | 5 | ❌ |

---

## Critique

### C-01 — Secrets en clair dans les fichiers d'exemple commités

**Fichiers** : `api/api.env.example`, `front/.env.prod.example`

Les fichiers `.example` contiennent des vraies valeurs de secrets (`SECRET_KEY`, `NEXTAUTH_SECRET`) au lieu de placeholders. Ces fichiers sont versionnés dans Git.

**Risque** : Si ces valeurs sont réutilisées en production, les JWT sont forge­ables et les sessions sont compromises.

**Remédiation** :
- Remplacer les valeurs par des placeholders (`CHANGE_ME`, `<generate with openssl rand -hex 64>`)
- Rotation immédiate de tous les secrets déployés
- Vérifier l'historique Git (`git log -p -- "*.example"`)

---

### C-02 — CORS `allow_origins=["*"]` avec `allow_credentials=True`

**Fichier** : `api/main.py` (lignes 28-34)

```python
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
)
```

La combinaison `*` + credentials autorise n'importe quel site tiers à effectuer des requêtes authentifiées vers l'API.

**Risque** : Un site malveillant peut exécuter des actions au nom d'un utilisateur connecté (CSRF cross-origin).

**Remédiation** :
```python
origins = [
    "https://votre-domaine.com",
    "http://localhost:3000",  # dev only
]
```

---

## Haute

### H-01 — Aucun rate limiting

**Fichiers** : `api/main.py`, `Caddyfile`

Aucune limitation de débit n'est en place, ni côté API (pas de `slowapi` / middleware), ni côté reverse proxy (pas de `rate_limit` dans Caddy).

**Risque** : Brute-force sur `/auth/discord`, spam de requêtes, déni de service applicatif.

**Remédiation** :
- Installer `slowapi` sur FastAPI avec des limites par IP
- Ou ajouter un `rate_limit` dans le Caddyfile pour les endpoints sensibles

---

### H-02 — phpMyAdmin exposé sans authentification supplémentaire

**Fichiers** : `Caddyfile` (ligne 10-12), `compose.yaml`

phpMyAdmin est accessible publiquement via `/phpmyadmin/` avec uniquement les credentials MariaDB comme protection. Le conteneur est présent dans le compose de production.

**Risque** : Accès direct à la base de données par quiconque atteint le serveur.

**Remédiation** :
- Retirer phpMyAdmin du compose de production (déjà fait dans `compose.prod.yaml`)
- Si nécessaire en dev, protéger par HTTP Basic Auth dans Caddy

---

### H-03 — Credentials base de données faibles par défaut

**Fichiers** : `db.env`, `api/src/security/secrets.py`

Les credentials par défaut sont `user` / `password` / `rootpassword`. En mode dev (`MODE != "prod"`), ces valeurs sont utilisées automatiquement comme fallback.

**Risque** : Si déployé sans `MODE=prod`, la DB est accessible avec des credentials triviaux.

**Remédiation** :
- Générer des mots de passe forts pour la production
- Documenter clairement la nécessité de `MODE=prod`

---

### H-04 — HTTPS désactivé

**Fichier** : `Caddyfile` (ligne 2)

```
auto_https off
```

Tout le trafic (JWT, cookies de session, credentials phpMyAdmin) circule en clair.

**Risque** : Interception des tokens d'authentification, man-in-the-middle.

**Remédiation** :
- Retirer `auto_https off` en production — Caddy provisionne automatiquement des certificats Let's Encrypt
- Le `Caddyfile.prod` fourni corrige ce point

---

### H-05 — Clé JWT secrète dev prévisible

**Fichier** : `api/src/security/secrets.py` (ligne 19)

```python
SECRET_KEY: str = Field(... if IS_PROD else "dev-secret-key_dev-secret-key_dev-secret-key")
```

En mode non-prod, la clé est une chaîne connue. Si `MODE` n'est pas défini, les JWT sont forge­ables.

**Risque** : Authentification contournable sur tout déploiement non-explicitement marqué `MODE=prod`.

**Remédiation** :
- Toujours exiger `SECRET_KEY` via variable d'environnement
- Vérifier `MODE=prod` dans le script de démarrage (`run.sh`)

---

## Moyenne

### M-01 — Aucun header de sécurité HTTP

**Fichiers** : `Caddyfile`, `api/main.py`, `front/next.config.ts`

Aucun des composants ne définit :
- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Strict-Transport-Security`
- `Referrer-Policy`
- `Permissions-Policy`

**Risque** : Clickjacking, MIME-sniffing, XSS en profondeur.

**Remédiation** :
Ajouter dans le Caddyfile :
```
header {
    X-Frame-Options "DENY"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Content-Security-Policy "default-src 'self'"
    Permissions-Policy "camera=(), microphone=(), geolocation=()"
}
```

---

### M-02 — JWT loggé en mode non-production

**Fichier** : `api/src/controllers/auth_controller.py`

Le JWT complet est loggé au niveau WARNING quand `IS_PROD` est faux. Si les logs sont persistés, les tokens de session sont exposés.

**Remédiation** : Supprimer ou masquer le log du token.

---

### M-03 — Pas de révocation JWT

L'application utilise des JWT stateless sans mécanisme de blacklist. Un utilisateur désactivé ou supprimé conserve un JWT valide jusqu'à expiration (60 minutes max).

**Remédiation** :
- Implémenter un cache Redis pour les tokens révoqués
- Ou réduire la durée de vie des tokens (15 min) avec un refresh token

---

### M-04 — Endpoint `POST /auth/session` accepte des tokens dans le body

**Fichier** : `api/src/controllers/auth_controller.py`

Cet endpoint décode n'importe quel JWT passé dans le body, contournant le flux standard `Authorization` header.

**Remédiation** : Restreindre ou supprimer cet endpoint, ou le protéger par un flag `IS_PROD`.

---

### M-05 — Socket Docker monté dans Watchtower

**Fichier** : `compose.yaml` (ligne 79-80)

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

Le montage du socket Docker donne un accès root à l'hôte depuis le conteneur Watchtower.

**Remédiation** :
- Acceptable si Watchtower est nécessaire, mais documenter le risque
- Alternative : utiliser un socket proxy en lecture seule

---

### M-06 — Connexion DB non chiffrée

**Fichier** : `api/src/utils/db.py`

La chaîne de connexion `mysql+aiomysql://` ne spécifie pas de paramètre SSL. Le trafic entre l'API et MariaDB est en clair sur le réseau Docker interne.

**Remédiation** : Configurer SSL/TLS pour MariaDB si le réseau n'est pas isolé.

---

## Basse

### L-01 — Header `X-Process-Time` expose des informations de timing

**Fichier** : `api/main.py` (ligne 79)

Chaque réponse inclut le temps de traitement, ce qui peut aider un attaquant à identifier les opérations lentes.

**Remédiation** : Supprimer ce header en production ou le conditionner à `IS_PROD`.

---

### L-02 — Sortie debug `icecream` en production

**Fichier** : `api/main.py` (lignes 24-25)

```python
ic(f"Targeted db: {SECRET.MARIADB_DATABASE}")
ic(app.routes)
```

Affiche le nom de la base de données et toutes les routes dans stdout.

**Remédiation** : Conditionner par `if not IS_PROD`.

---

### L-03 — Image MariaDB sans version épinglée

**Fichier** : `compose.yaml` (ligne 6)

`image: mariadb` sans tag de version. Une mise à jour cassante upstream peut impacter silencieusement le déploiement.

**Remédiation** : Épingler la version (ex: `mariadb:11.4`). Corrigé dans `compose.prod.yaml` avec `mariadb:11`.

---

### L-04 — `trustHost: true` dans la config NextAuth

**Fichier** : `front/app/api/auth/[...nextauth]/route.ts`

Désactive la validation du header Host. Acceptable derrière un reverse proxy qui sanitize le header, mais risque d'injection de header Host sinon.

**Remédiation** : S'assurer que Caddy ne transmet pas de header Host arbitraire.

---

### L-05 — Pas de politique de complexité des credentials DB

Les credentials MariaDB ne sont soumis à aucune politique de complexité ou rotation.

**Remédiation** : Documenter les exigences minimales de complexité pour la production.

---

## Points Positifs

| # | Constat |
|---|---------|
| ✅ | Pas d'injection SQL — utilisation systématique de SQLModel/SQLAlchemy avec requêtes paramétrées |
| ✅ | Pas d'authentification par mot de passe — OAuth Discord exclusivement, élimine le credential stuffing |
| ✅ | JWT non exposé au navigateur — proxy via `/api/back/`, protège contre le vol de token par XSS |
| ✅ | Flow de refresh token correct — le rafraîchissement du token Discord ré-authentifie proprement |
| ✅ | Validation admin côté backend — `is_logged_as_admin` vérifie le rôle en base, pas seulement côté client |
| ✅ | Conteneurs non-root — API et Front tournent avec des utilisateurs dédiés (`fastapi`, `nextjs`) |

---

## Plan de Remédiation Prioritaire

| Priorité | Action | Effort |
|----------|--------|--------|
| 1 | Restreindre les CORS à l'origine réelle | 5 min |
| 2 | Rotation de tous les secrets (JWT, NEXTAUTH, Discord, DB) | 30 min |
| 3 | Nettoyer les fichiers `.example` des vraies valeurs | 5 min |
| 4 | Activer HTTPS (retirer `auto_https off`) | 5 min |
| 5 | Retirer phpMyAdmin du compose prod | ✅ Fait |
| 6 | Ajouter rate limiting (`slowapi`) | 2h |
| 7 | Ajouter les headers de sécurité dans Caddy | 15 min |
| 8 | Conditionner les logs debug par `IS_PROD` | 10 min |
