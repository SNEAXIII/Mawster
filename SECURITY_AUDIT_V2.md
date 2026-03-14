# Audit de Sécurité V2 — Mawster

**Date** : Juillet 2025  
**Réf. précédente** : `SECURITY_AUDIT.md` (25 février 2026)  
**Périmètre** : API FastAPI, Frontend Next.js, Infrastructure Docker/Caddy, Base de données MariaDB

---

## Résumé exécutif

Ce rapport met à jour l'audit initial de février 2026. Plusieurs vulnérabilités critiques et hautes ont été **corrigées**, mais des problèmes significatifs **persistent** et de **nouvelles failles** ont été identifiées lors de l'analyse approfondie du code source.

---

## Tableau de bord

### Corrections depuis V1

| Réf. | Sévérité | Titre                                | Statut                                               |
| ---- | -------- | ------------------------------------ | ---------------------------------------------------- |
| C-01 | Critique | Secrets en clair dans `.example`     | ✅ **CORRIGÉ** — placeholders `CHANGE_ME`            |
| C-02 | Critique | CORS `allow_origins=["*"]`           | ✅ **CORRIGÉ** — `ALLOWED_ORIGINS` depuis env        |
| L-01 | Basse    | Header `X-Process-Time` en prod      | ✅ **CORRIGÉ** — conditionné par `not IS_PROD`       |
| L-02 | Basse    | Sortie debug `icecream`              | ✅ **CORRIGÉ** — remplacé par `logging` standard     |
| L-03 | Basse    | Image MariaDB sans version           | ✅ **CORRIGÉ** — épinglé `mariadb:11.4`              |
| M-01 | Moyenne  | Headers de sécurité HTTP             | ⚠️ **PARTIEL** — 4/6 headers ajoutés                 |
| M-02 | Moyenne  | JWT loggé en non-prod                | ✅ **CORRIGÉ** — plus de log du token                |
| M-04 | Moyenne  | `POST /auth/session` avec token body | ⚠️ **ATTÉNUÉ** — déplacé en `/dev/session`, dev-only |

### Vulnérabilités persistantes

| Réf. | Sévérité | Titre                               |
| ---- | -------- | ----------------------------------- |
| H-01 | Haute    | Aucun rate limiting                 |
| H-02 | Haute    | phpMyAdmin exposé en production     |
| H-04 | Haute    | HTTPS désactivé                     |
| H-05 | Haute    | Clé JWT secrète dev prévisible      |
| H-03 | Haute    | Credentials DB faibles par défaut   |
| M-03 | Moyenne  | Pas de révocation JWT               |
| M-05 | Moyenne  | Socket Docker monté dans Watchtower |
| M-06 | Moyenne  | Connexion DB non chiffrée           |
| L-04 | Basse    | `trustHost: true` dans NextAuth     |
| L-05 | Basse    | Pas de politique de complexité DB   |

### Nouvelles vulnérabilités découvertes

| Réf.     | Sévérité     | Titre                                                           |
| -------- | ------------ | --------------------------------------------------------------- |
| **N-01** | **Critique** | Middleware frontend inactif (`proxy.ts` ≠ `middleware.ts`)      |
| **N-02** | **Haute**    | Refresh token non invalidé à la rotation                        |
| **N-03** | **Haute**    | Dev controller sans authentification                            |
| **N-04** | **Haute**    | Suppression de compte sans cascade alliance                     |
| **N-05** | **Moyenne**  | Headers de sécurité incomplets (CSP, HSTS manquants)            |
| **N-06** | **Moyenne**  | Endpoint champion load sans limite de taille                    |
| **N-07** | **Moyenne**  | Données d'alliance exposées sans restriction                    |
| **N-08** | **Basse**    | Champ `error_count` dupliqué dans DTO defense                   |
| **N-09** | **Basse**    | Suppression game account sans vérification d'ownership alliance |
| **N-10** | **Basse**    | Self-delete sans nettoyage des données liées                    |

---

## Détail des nouvelles vulnérabilités

---

### N-01 — Middleware frontend inactif (CRITIQUE)

**Fichier** : `front/proxy.ts`

Le fichier de middleware Next.js est nommé `proxy.ts` au lieu de `middleware.ts`. De plus, la fonction exportée s'appelle `proxy` au lieu de `middleware`. Next.js **requiert** que le fichier soit nommé `middleware.ts` à la racine du projet et que la fonction exportée s'appelle `middleware`.

```typescript
// proxy.ts — fichier JAMAIS invoqué par Next.js
export async function proxy(request: NextRequest) { ... }
```

**Conséquence** :

- Aucune protection de route côté frontend
- Les utilisateurs non authentifiés accèdent aux pages protégées (les appels API échouent mais l'interface est visible)
- Pas de redirection vers `/login` pour les utilisateurs non connectés
- Pas de protection des routes `/admin` côté frontend
- Le code de middleware existe mais est **mort** — fausse impression de sécurité

**Risque** : Exposition de l'interface d'administration, fuite de la structure de l'application, confusion UX avec des pages affichant des erreurs 401 au lieu de redirections propres.

**Remédiation** :

```bash
# Renommer le fichier
mv front/proxy.ts front/middleware.ts
```

```typescript
// front/middleware.ts
export async function middleware(request: NextRequest) { ... }  // renommer la fonction
```

---

### N-02 — Refresh token non invalidé à la rotation (HAUTE)

**Fichier** : `api/src/controllers/auth_controller.py` → `refresh_access_token`

Lors du refresh d'un token, un nouveau couple `(access_token, refresh_token)` est émis, mais l'ancien refresh token **reste valide** jusqu'à son expiration naturelle (7 jours).

```python
@auth_controller.post("/refresh", status_code=200)
async def refresh_access_token(body: RefreshTokenRequest, session: SessionDep):
    data = JWTService.decode_refresh_token(body.refresh_token)
    user = await UserService.get_user_by_id_with_validity_check(session, data["user_id"])
    # ⚠️ Ancien refresh_token toujours valide, réutilisable
    new_access_token = JWTService.create_access_token(user)
    new_refresh_token = JWTService.create_refresh_token(user)
    return LoginResponse(...)
```

**Risque** : Un attaquant qui intercepte un refresh token peut l'utiliser indéfiniment pour générer de nouveaux access tokens, même après que l'utilisateur légitime a obtenu un nouveau paire de tokens.

**Remédiation** :

- Implémenter un système de "refresh token rotation" avec famille de tokens
- Stocker les refresh tokens en base (table `refresh_tokens`) et invalider l'ancien à chaque rotation
- Détecter la réutilisation d'un ancien refresh token comme indicateur de compromission et invalider toute la famille

---

### N-03 — Dev controller sans authentification (HAUTE)

**Fichier** : `api/src/controllers/dev_controller.py`

Le dev controller est conditionné par `not IS_PROD` dans `main.py`, mais les endpoints n'ont **aucune authentification**. Quiconque atteint l'API en mode dev/testing peut :

- **`POST /dev/truncate`** — Supprimer toutes les données de la base
- **`POST /dev/fixtures`** — Exécuter des scripts Python arbitraires depuis `/fixtures/`
- **`POST /dev/login`** — Se connecter en tant que n'importe quel utilisateur
- **`POST /dev/promote`** — Promouvoir n'importe quel utilisateur en admin
- **`POST /dev/force-join-alliance`** — Contourner toutes les vérifications d'alliance

```python
dev_controller = APIRouter(
    prefix="/dev",
    tags=["Dev"],
    # ⚠️ Aucun Depends(AuthService.is_logged_as_...) !
)
```

**Risque** : Si `MODE` n'est pas correctement défini (oubli, mauvaise config), ces endpoints destructifs sont accessibles publiquement.

**Remédiation** :

- Ajouter une vérification `is_logged_as_super_admin` comme dépendance au routeur
- Ou ajouter un header secret comme garde supplémentaire
- Vérifier que `MODE=prod` est systématiquement défini dans tous les déploiements (CI, scripts, compose)
- Ajouter un test automatique qui vérifie que le dev controller n'est PAS inclus quand `MODE=prod`

---

### N-04 — Suppression de compte sans cascade alliance (HAUTE)

**Fichiers** : `api/src/services/UserService.py` → `self_delete`, `admin_delete_user`  
**Fichiers** : `api/src/services/GameAccountService.py` → `delete_game_account`

Quand un utilisateur est supprimé (soft delete) ou qu'un game account est supprimé :

1. **Self-delete utilisateur** : Met `deleted_at` mais ne touche PAS aux game accounts, alliances, rosters, defense placements, invitations
2. **Delete game account** : Supprime le game account mais ne vérifie PAS s'il est owner d'une alliance

```python
# UserService.self_delete — pas de nettoyage
async def self_delete(cls, session, current_user):
    current_user.deleted_at = datetime.now()
    await session.commit()  # ⚠️ Aucun cascade

# GameAccountService.delete_game_account — pas de vérification owner
async def delete_game_account(cls, session, game_account):
    await session.delete(game_account)  # ⚠️ Et si c'est l'owner d'une alliance ?
    await session.commit()
```

**Risque** :

- Alliance orpheline sans owner → impossible à gérer ou supprimer
- Game accounts fantômes avec `user_id` pointant vers un utilisateur supprimé
- Defense placements référençant des champions d'un roster supprimé
- Données incohérentes en cascade

**Remédiation** :

- **Self-delete** : Avant la suppression, vérifier les alliances possédées et soit transférer l'ownership, soit forcer la suppression de l'alliance
- **Delete game account** : Vérifier `alliance.owner_id != game_account.id` et refuser la suppression si le compte est owner. Alternative : transférer automatiquement l'ownership à un officier
- Nettoyer les invitations, defense placements et upgrade requests liés

---

### N-05 — Headers de sécurité incomplets (MOYENNE)

**Fichier** : `Caddyfile`

Le Caddyfile ajoute désormais 4 headers de sécurité (amélioration depuis V1), mais 2 headers critiques sont encore absents :

```
header {
    X-Frame-Options "DENY"              ✅
    X-Content-Type-Options "nosniff"    ✅
    Referrer-Policy "strict-..."        ✅
    Permissions-Policy "camera=()..."   ✅
    -Server                             ✅
    # ❌ Content-Security-Policy        MANQUANT
    # ❌ Strict-Transport-Security      MANQUANT
}
```

**Risque** :

- Sans **CSP** : XSS en profondeur, injection de scripts tiers, exfiltration de données
- Sans **HSTS** : Downgrade HTTPS → HTTP possible (surtout quand H-04 sera corrigé)

**Remédiation** :

```
header {
    # ... headers existants ...
    Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'"
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
}
```

---

### N-06 — Endpoint champion load sans limite de taille (MOYENNE)

**Fichier** : `api/src/controllers/champion_controller.py` → `load_champions`

```python
@champion_controller.post("/load", status_code=200)
async def load_champions(
    session: SessionDep,
    champions: list[ChampionLoadRequest],  # ⚠️ Pas de max_length
):
```

L'endpoint accepte une liste de taille illimitée. Un admin malveillant ou un attaquant avec un token admin peut envoyer des millions d'entrées, causant un DoS sur la base de données.

**Risque** : Déni de service applicatif, saturation mémoire, ralentissement de la DB.

**Remédiation** :

```python
champions: list[ChampionLoadRequest] = Body(..., max_length=500)
```

---

### N-07 — Données d'alliance exposées sans restriction (MOYENNE)

**Fichier** : `api/src/controllers/alliance_controller.py`

Plusieurs endpoints exposent des données sensibles à **tout utilisateur authentifié**, sans vérification d'appartenance :

| Endpoint                                | Données exposées                                 |
| --------------------------------------- | ------------------------------------------------ |
| `GET /alliances`                        | Toutes les alliances avec membres, tag, officers |
| `GET /alliances/{id}`                   | Alliance complète avec détails des membres       |
| `GET /alliances/eligible-members`       | Tous les game accounts sans alliance             |
| `GET /alliances/{id}/eligible-officers` | Membres non-officers d'une alliance tierce       |

```python
# Aucune vérification — tout utilisateur connecté voit tout
@alliance_controller.get("")
async def get_all_alliances(session: SessionDep):
    alliances = await AllianceService.get_all_alliances(session)
    return [_to_response(a) for a in alliances]
```

**Risque** :

- Énumération de tous les joueurs et leurs associations
- Reconnaissance de la structure des alliances adverses
- Exposition des pseudos de jeu de tous les utilisateurs

**Remédiation** :

- `GET /alliances` : Limiter les données retournées (exclure la liste des membres, ne garder que nom/tag/member_count)
- `GET /alliances/{id}/eligible-officers` : Restreindre au owner/officers de l'alliance
- `GET /alliances/eligible-members` : Restreindre aux owners/officers (seuls ceux qui peuvent inviter)

---

### N-08 — Champ `error_count` dupliqué dans DTO defense (BASSE)

**Fichier** : `api/src/dto/dto_defense.py`

```python
class DefenseImportReport(BaseModel):
    before: list[DefenseReportItem]
    after: list[DefenseReportItem]
    errors: list[DefenseImportError]
    success_count: int
    error_count: int
    error_count: int  # ⚠️ Déclaration dupliquée
```

**Risque** : Bug Python silencieux — la seconde déclaration écrase la première. Pydantic pourrait potentiellement mal sérialiser. Pas de risque de sécurité direct mais indicateur de code review insuffisant.

**Remédiation** : Supprimer la ligne dupliquée.

---

### N-09 — Suppression game account sans vérification ownership alliance (BASSE)

**Fichier** : `api/src/controllers/game_account_controller.py` → `delete_game_account`

La suppression d'un game account vérifie uniquement que le compte appartient à l'utilisateur courant, mais ne vérifie PAS si ce compte est owner d'une alliance.

**Remédiation** : Ajouter un check :

```python
if game_account.alliance_id:
    alliance = await AllianceService.get_alliance(session, game_account.alliance_id)
    if alliance and alliance.owner_id == game_account.id:
        raise HTTPException(status_code=400, detail="Vous devez transférer ou supprimer votre alliance d'abord")
```

---

### N-10 — Self-delete sans nettoyage des données liées (BASSE)

**Fichier** : `api/src/services/UserService.py` → `self_delete`

Lors du self-delete, seul `deleted_at` est positionné. Les éléments suivants restent en place :

- Game accounts actifs avec `user_id` pointant vers l'utilisateur supprimé
- Rosters de champions
- Defense placements
- Upgrade requests
- Officer appointments

Les requêtes ultérieures qui font des jointures sur `User` pourraient renvoyer des résultats inattendus.

**Remédiation** :

- Soft-delete en cascade les game accounts
- Supprimer les defense placements du joueur
- Annuler les upgrade requests en cours
- Révoquer les roles d'officier

---

## Vulnérabilités persistantes — Détail de suivi

### H-01 — Aucun rate limiting (PERSIST)

**État actuel** : Le code du rate limiter est commenté dans `main.py` :

```python
# limiter = Limiter(key_func=get_remote_address)
# app.state.limiter = limiter
# app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

Le Caddyfile transmet désormais `X-Real-IP` et `X-Forwarded-For`, ce qui est un prérequis pour le rate limiting, mais la fonctionnalité n'est toujours pas activée.

**Impact** : Brute-force sur `/auth/discord`, `/auth/refresh`, spam de requêtes, DoS applicatif.

---

### H-02 — phpMyAdmin exposé en production (PERSIST)

**État actuel** : phpMyAdmin est **toujours** dans `compose.prod.yaml` :

```yaml
phpmyadmin:
  image: phpmyadmin/phpmyadmin
  container_name: myadmin
```

Et le Caddyfile route toujours vers `/myadmin*` :

```
handle_path /myadmin* {
    reverse_proxy myadmin:85
}
```

**Remédiation** : Supprimer le service `phpmyadmin` de `compose.prod.yaml` et la route `/myadmin*` du `Caddyfile` de production.

---

### H-04 — HTTPS désactivé (PERSIST)

`auto_https off` est toujours dans le Caddyfile. Tout le trafic (JWT, session cookies, credentials phpMyAdmin) circule en clair.

---

### M-03 — Pas de révocation JWT (PERSIST)

Les JWT sont toujours stateless. Un utilisateur désactivé via `/admin/users/disable/{id}` conserve un JWT valide pendant 60 minutes maximum. Combiné avec N-02 (refresh token non invalidé), un utilisateur désactivé peut potentiellement régénérer des tokens via refresh pendant 7 jours.

**Impact aggravé par N-02** : La combinaison M-03 + N-02 signifie qu'un utilisateur banni peut continuer à accéder au système pendant 7 jours via refresh tokens.

---

### M-05 — Socket Docker dans Watchtower (PERSIST)

Watchtower est présent dans `compose.yaml` (dev) avec le socket Docker monté :

```yaml
watchtower:
  image: containrrr/watchtower
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
```

Non présent dans `compose.prod.yaml` — le risque est limité à l'environnement de dev.

---

## Points Positifs (mis à jour)

| #   | Constat                                                                             |
| --- | ----------------------------------------------------------------------------------- |
| ✅  | Pas d'injection SQL — SQLModel/SQLAlchemy avec requêtes paramétrées                 |
| ✅  | OAuth Discord exclusif — pas de credential stuffing possible                        |
| ✅  | CORS corrigé — origines spécifiques depuis variable d'env                           |
| ✅  | Secrets `.example` nettoyés avec placeholders `CHANGE_ME`                           |
| ✅  | Logging structuré — audit trail sur les actions sensibles                           |
| ✅  | Conteneurs non-root — utilisateurs dédiés `fastapi`, `nextjs`                       |
| ✅  | Validation Pydantic — tous les DTOs valident les entrées (longueur, format, bornes) |
| ✅  | Contrôle de rôles backend — vérification en base pour chaque endpoint protégé       |
| ✅  | MariaDB version épinglée en production                                              |
| ✅  | Headers de sécurité partiellement implémentés dans Caddy                            |
| ✅  | X-Process-Time conditionné par IS_PROD                                              |
| ✅  | Dev controller exclu en mode prod                                                   |

---

## Plan de remédiation prioritaire (mis à jour)

| Prio | Réf.          | Action                                                                 | Effort | Impact   |
| ---- | ------------- | ---------------------------------------------------------------------- | ------ | -------- |
| 1    | **N-01**      | Renommer `proxy.ts` → `middleware.ts`, renommer `proxy` → `middleware` | 5 min  | Critique |
| 2    | H-04          | Activer HTTPS (retirer `auto_https off`)                               | 5 min  | Haute    |
| 3    | H-02          | Retirer phpMyAdmin de `compose.prod.yaml` et route Caddy               | 10 min | Haute    |
| 4    | **N-04**      | Ajouter vérifications cascade sur self-delete et delete game account   | 2h     | Haute    |
| 5    | H-01          | Activer `slowapi` rate limiting (code commenté prêt)                   | 1h     | Haute    |
| 6    | **N-02**      | Implémenter rotation de refresh tokens avec invalidation               | 4h     | Haute    |
| 7    | **N-03**      | Ajouter auth sur dev controller (super_admin)                          | 15 min | Haute    |
| 8    | **N-05**      | Ajouter CSP + HSTS dans Caddyfile                                      | 15 min | Moyenne  |
| 9    | M-03          | Implémenter blacklist JWT (Redis)                                      | 4h     | Moyenne  |
| 10   | **N-06**      | Ajouter `max_length` sur endpoint champion load                        | 5 min  | Moyenne  |
| 11   | **N-07**      | Restreindre les données exposées par les endpoints alliance            | 1h     | Moyenne  |
| 12   | **N-08**      | Corriger champ dupliqué `error_count`                                  | 1 min  | Basse    |
| 13   | **N-09/N-10** | Cascade suppression game account/utilisateur                           | 2h     | Basse    |

---

## Métriques

| Métrique                 | V1 (Fév. 2026) | V2 (Jul. 2025)                           |
| ------------------------ | -------------- | ---------------------------------------- |
| Vulnérabilités critiques | 2              | 1 (+1 nouvelle, -2 corrigées)            |
| Vulnérabilités hautes    | 5              | 7 (+3 nouvelles, -0 corrigées)           |
| Vulnérabilités moyennes  | 6              | 6 (+3 nouvelles, -3 corrigées/atténuées) |
| Vulnérabilités basses    | 5              | 5 (+3 nouvelles, -3 corrigées)           |
| **Total**                | **18**         | **19**                                   |
| Corrigées depuis V1      | —              | 8                                        |
