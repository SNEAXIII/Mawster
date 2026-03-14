# Rapport de sécurité – Projet Mawster (Front + API + Infra + Tests)

Date d'analyse : 2026-02-13  
Dernière mise à jour : 2026-02-13  
Analystes : Audit automatisé complet du code source

## Portée de l'analyse

| Couche         | Technologies                                           | Fichiers analysés                                         |
| -------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| Front-end      | Next.js 14, NextAuth, Tailwind                         | middleware, services, pages, composants, config           |
| API Backend    | FastAPI, SQLModel, PyJWT, Bleach, Passlib/bcrypt       | controllers, services, models, DTOs, validators, fixtures |
| Infrastructure | Docker Compose, Caddy, MariaDB, Watchtower, phpMyAdmin | Dockerfiles, compose.yaml, Caddyfile, env files           |
| Tests          | Pytest, SQLite (tests isolés)                          | conftest, utils, intégration                              |

---

## Table des matières

1. [Points positifs (bonnes pratiques)](#points-positifs-bonnes-pratiques)
2. [Vulnérabilités critiques](#-vulnérabilités-critiques)
3. [Vulnérabilités hautes](#-vulnérabilités-hautes)
4. [Vulnérabilités moyennes](#-vulnérabilités-moyennes)
5. [Vulnérabilités basses](#-vulnérabilités-basses)
6. [Informationnel](#ℹ️-informationnel)
7. [Synthèse & tableau récapitulatif](#synthèse)
8. [Recommandations prioritaires](#recommandations-prioritaires)

---

## Points positifs (bonnes pratiques)

### ✅ PP-01 — Protection d'accès par middleware (rôles + redirections)

- **Score : 8/10**
- Les routes sensibles (`/dashboard`, `/admin`, `/articles/create`) sont filtrées avant rendu côté serveur, ce qui réduit l'exposition côté client. Le middleware vérifie le token NextAuth et le rôle.
- Référence : [front/middleware.ts](front/middleware.ts#L1-L56)

### ✅ PP-02 — Auth centralisée via NextAuth (session JWT httpOnly)

- **Score : 7/10**
- Gestion centralisée de session, cookies httpOnly par défaut, pas de stockage explicite en `localStorage`. Le flow OAuth2 password est encapsulé proprement.
- Référence : [front/app/api/auth/[...nextauth]/route.ts](front/app/api/auth/%5B...nextauth%5D/route.ts#L1-L150)

### ✅ PP-03 — Validation client pour la création d'articles (Zod)

- **Score : 6/10**
- Des schémas `zod` limitent les entrées invalides avant envoi côté article creation.
- Référence : [front/app/articles/create/page.tsx](front/app/articles/create/page.tsx#L28-L73)

### ✅ PP-04 — Sanitization serveur du HTML d'articles (Bleach, whitelist)

- **Score : 8/10**
- Contenu HTML nettoyé côté API avant stockage. Tags restreints via whitelist explicite, `strip=True`, aucun attribut autorisé (empêche `onclick`, `onerror`, etc.).
- Référence : [api/src/utils/sanitizer.py](api/src/utils/sanitizer.py#L1-L36), [api/src/services/ArticlesService.py](api/src/services/ArticlesService.py#L31-L33)

### ✅ PP-05 — Validation robuste des mots de passe (backend)

- **Score : 8/10**
- Politique de mot de passe stricte : 10-50 caractères, majuscule, minuscule, chiffre, caractère spécial. Comparaison par `hmac.compare_digest` (constant-time) pour éviter les timing attacks.
- Référence : [api/src/validators/user_validator.py](api/src/validators/user_validator.py#L27-L73)

### ✅ PP-06 — Hachage bcrypt avec rounds configurables

- **Score : 8/10**
- Utilisation de `passlib` avec bcrypt. En production, minimum 12 rounds (`ge=12 if IS_PROD`). Hachage asynchrone via `run_in_executor` pour ne pas bloquer l'event loop.
- Référence : [api/src/services/PasswordService.py](api/src/services/PasswordService.py#L1-L25), [api/src/security/secrets.py](api/src/security/secrets.py#L22)

### ✅ PP-07 — Messages d'erreur non-révélateurs (énumération d'utilisateurs)

- **Score : 7/10**
- Le message d'erreur d'authentification est générique ("Les identifiants saisis sont incorrects"), ce qui évite l'énumération d'utilisateurs via le endpoint login. Le message `USER_DOESNT_EXISTS` utilise aussi un libellé générique.
- Référence : [api/src/Messages/jwt_messages.py](api/src/Messages/jwt_messages.py#L21), [api/src/Messages/user_messages.py](api/src/Messages/user_messages.py#L25-L27)

### ✅ PP-08 — Soft-delete et désactivation de comptes

- **Score : 7/10**
- Les comptes ne sont pas supprimés physiquement : `deleted_at` et `disabled_at` permettent un audit trail. Les utilisateurs supprimés/désactivés ne peuvent pas se connecter.
- Référence : [api/src/services/UserService.py](api/src/services/UserService.py#L80-L89)

### ✅ PP-09 — Conteneurs Docker non-root

- **Score : 8/10**
- Les Dockerfiles créent des utilisateurs dédiés (`fastapi` uid 1001 pour l'API, `nextjs` uid 1001 pour le front) et exécutent les processus sous ces utilisateurs.
- Référence : [api/api.Dockerfile](api/api.Dockerfile#L10-L22), [front/front.Dockerfile](front/front.Dockerfile#L43-L66)

### ✅ PP-10 — Journalisation des connexions (LoginLog)

- **Score : 7/10**
- Chaque connexion réussie crée une entrée `LoginLog` avec horodatage, permettant un audit des accès.
- Référence : [api/src/services/AuthService.py](api/src/services/AuthService.py#L34-L37), [api/src/models/LoginLog.py](api/src/models/LoginLog.py#L1-L20)

### ✅ PP-11 — UUID pour les identifiants utilisateur

- **Score : 8/10**
- Utilisation de `uuid4` au lieu d'entiers auto-incrémentés pour les IDs utilisateur, ce qui rend l'énumération séquentielle impossible.
- Référence : [api/src/models/User.py](api/src/models/User.py#L17)

### ✅ PP-12 — Validation d'email par bibliothèque dédiée

- **Score : 7/10**
- Utilisation de `email_validator` (bibliothèque Python) pour la validation syntaxique des emails, plus fiable qu'une regex maison.
- Référence : [api/src/validators/user_validator.py](api/src/validators/user_validator.py#L43-L51)

### ✅ PP-13 — Fichiers `.env` exclus du versioning Git

- **Score : 7/10**
- Le `.gitignore` racine exclut `*.env` et le `.gitignore` front exclut `.env*.local` et `.env`. Seuls les `.env.example` sont commités (mais voir vulnérabilité C-01).
- Référence : [.gitignore](.gitignore#L6-L7)

### ✅ PP-14 — Mot de passe admin aléatoire en production (fixtures init)

- **Score : 7/10**
- Le script `first_init_prod.py` génère un mot de passe aléatoire de 100 caractères pour le compte admin initial, qui doit être changé manuellement après déploiement.
- Référence : [api/src/fixtures/first_init_prod.py](api/src/fixtures/first_init_prod.py#L17)

---

## 🔴 Vulnérabilités critiques

### C-01 — Secret NextAuth identique dans dev ET prod (commité dans le repo)

- **Score : 1/10** | **CVSS estimé : 9.8** | **CWE-798 (Hardcoded Credentials)**
- **Constat** : Les deux fichiers `.env.example` contiennent le **même secret réel** `53iKwUzzLQaqlkyx5q1gfxdtWfy47Qd1nTekegi/Qj8=`. Ces fichiers sont versionnés dans Git (`!*.env.example` dans `.gitignore`). Toute personne ayant accès au dépôt peut forger des cookies de session NextAuth.
- **Impact** : Usurpation de session de n'importe quel utilisateur, y compris administrateur. Accès complet à l'application.
- **Remédiation** : Remplacer par un placeholder (ex: `CHANGE_ME_GENERATE_WITH_openssl_rand_base64_32`) et documenter que la valeur doit être régénérée par environnement.
- Référence : [front/.env.dev.example](front/.env.dev.example#L1), [front/.env.prod.example](front/.env.prod.example#L1)

### C-02 — CORS `allow_origins=["*"]` avec `allow_credentials=True`

- **Score : 2/10** | **CVSS estimé : 8.1** | **CWE-942 (Overly Permissive CORS Policy)**
- **Constat** : L'API autorise TOUTES les origines (`"*"`) tout en autorisant l'envoi de credentials (`allow_credentials=True`). Cela signifie que n'importe quel site web peut effectuer des requêtes authentifiées vers l'API au nom d'un utilisateur connecté.
- **Impact** : CSRF cross-origin, vol de données via un site malveillant, exfiltration de tokens.
- **Note technique** : La spec CORS interdit `Access-Control-Allow-Origin: *` avec credentials — les navigateurs bloquent, mais certains clients HTTP non. Le vrai risque est si Starlette reflète l'origin (comportement par défaut quand `allow_origins=["*"]` + `allow_credentials=True`).
- **Remédiation** : Spécifier explicitement les origines autorisées : `allow_origins=["https://votre-domaine.com"]`.
- Référence : [api/main.py](api/main.py#L25-L32)

### C-03 — JWT décodé sans vérification de signature (côté NextAuth)

- **Score : 3/10** | **CVSS estimé : 7.5** | **CWE-345 (Insufficient Verification of Data Authenticity)**
- **Constat** : `jwt.decode()` est utilisé au lieu de `jwt.verify()` dans la route NextAuth. Le token backend est décodé sans validation de la signature.
- **Impact** : Si un attaquant intercepte ou forge un token (MITM sur le réseau interne HTTP), les claims (`role`, `email`, `user_id`) sont acceptés sans vérification.
- **Contexte atténuant** : Le token est reçu directement en réponse de l'API (pas fourni par l'utilisateur). Le risque est réel uniquement si le réseau interne est compromis.
- **Remédiation** : Utiliser `jwt.verify(token, SECRET_KEY)` ou alternativement faire confiance à la réponse API sans décoder le token (extraire les claims d'un endpoint `/auth/session`).
- Référence : [front/app/api/auth/[...nextauth]/route.ts](front/app/api/auth/%5B...nextauth%5D/route.ts#L55)

### C-04 — Secrets API faibles par défaut en mode non-prod

- **Score : 2/10** | **CVSS estimé : 8.5** | **CWE-1188 (Insecure Default Initialization)**
- **Constat** : Si la variable `MODE` n'est pas définie comme `"prod"`, les valeurs par défaut sont : `SECRET_KEY="dev-secret-key"`, `MARIADB_PASSWORD="password"`, `MARIADB_ROOT_PASSWORD="rootpassword"`, `BCRYPT_HASH_ROUND=8`. Le fichier `run.sh` définit `MODE="prod"` mais uniquement pour le conteneur Docker.
- **Impact** : En développement local ou si `MODE` n'est pas correctement défini, l'API utilise des secrets triviaux. Un attaquant peut signer ses propres JWT.
- **Remédiation** : Ne jamais utiliser de valeurs par défaut pour les secrets. Forcer l'échec au démarrage si les variables d'environnement critiques ne sont pas définies.
- Référence : [api/src/security/secrets.py](api/src/security/secrets.py#L11-L22), [api/run.sh](api/run.sh#L3)

---

## 🟠 Vulnérabilités hautes

### H-01 — `dangerouslySetInnerHTML` en fallback (XSS stocké)

- **Score : 3/10** | **CWE-79 (Cross-site Scripting - Stored)**
- **Constat** : Le composant `RichTextContent` utilise `dangerouslySetInnerHTML` comme fallback. Le contenu provient de l'API (articles créés par des admins).
- **Impact** : Si la sanitization backend (Bleach) est contournée ou si un futur développeur ajoute un tag autorisé dangereux, tout visiteur de l'article exécutera du JavaScript malveillant. Combiné avec le token d'accès exposé côté client (H-02), un XSS pourrait voler le bearer token API.
- **Facteur atténuant** : La sanitization Bleach est en place côté serveur et est stricte (aucun attribut autorisé). Le risque est résiduel mais viole le principe de défense en profondeur.
- **Remédiation** : Ajouter `DOMPurify` côté client avant le `dangerouslySetInnerHTML`, ou supprimer le fallback.
- Référence : [front/app/ui/html-viewer/RichTextContent.tsx](front/app/ui/html-viewer/RichTextContent.tsx#L22-L31)

### H-02 — Token d'accès API exposé dans la session client

- **Score : 4/10** | **CWE-200 (Exposure of Sensitive Information)**
- **Constat** : Le `accessToken` brut (JWT backend) est stocké dans le cookie de session NextAuth et accessible côté client via `session.accessToken`. Ce token permet un accès complet à l'API backend.
- **Impact** : En cas de XSS (voir H-01), l'attaquant peut exfiltrer le token et appeler l'API avec les droits de la victime (y compris admin).
- **Remédiation** : Garder le token côté serveur uniquement (dans le callback JWT de NextAuth) et utiliser des routes API Next.js comme proxy pour les requêtes authentifiées.
- Référence : [front/app/api/auth/[...nextauth]/route.ts](front/app/api/auth/%5B...nextauth%5D/route.ts#L81-L103)

### H-03 — Trafic HTTP non chiffré (front ↔ API, client ↔ serveur)

- **Score : 3/10** | **CWE-319 (Cleartext Transmission of Sensitive Information)**
- **Constat** : Toutes les URLs sont en `http://`. Le `Caddyfile` désactive explicitement HTTPS (`auto_https off`). Les mots de passe, tokens JWT et données personnelles transitent en clair.
- **Impact** : Interception de credentials et tokens par un attaquant sur le réseau (sniffing, MITM).
- **Remédiation** : Activer HTTPS dans Caddy (retirer `auto_https off`), configurer un certificat TLS (Let's Encrypt automatique avec Caddy), mettre à jour les URLs en `https://`.
- Référence : [Caddyfile](Caddyfile#L1-L3), [front/next.config.ts](front/next.config.ts#L9-L10)

### H-04 — Open redirect via `callbackUrl` non validée

- **Score : 4/10** | **CWE-601 (URL Redirection to Untrusted Site)**
- **Constat** : La page de login lit `callbackUrl` depuis les paramètres d'URL et redirige l'utilisateur vers cette URL après connexion, sans vérifier qu'il s'agit d'un chemin relatif interne.
- **Impact** : Un attaquant peut créer un lien `https://app.com/login?callbackUrl=https://evil.com` et rediriger la victime après connexion vers un site de phishing.
- **Remédiation** : Valider que `callbackUrl` commence par `/` et ne contient pas de `//` ou de protocole.
- Référence : [front/app/login/page.tsx](front/app/login/page.tsx)

### H-05 — phpMyAdmin exposé sans authentification supplémentaire

- **Score : 3/10** | **CWE-306 (Missing Authentication for Critical Function)**
- **Constat** : phpMyAdmin est accessible via `/phpmyadmin/` dans le Caddyfile de production, avec uniquement l'authentification MariaDB (dont les credentials par défaut sont `user`/`password`).
- **Impact** : Accès direct à la base de données en production, modification/suppression de données, exfiltration des hash de mots de passe.
- **Remédiation** : Retirer phpMyAdmin en production, ou le protéger par un VPN / basic auth Caddy / IP whitelist.
- Référence : [Caddyfile](Caddyfile#L9-L11), [compose.yaml](compose.yaml#L20-L30)

### H-06 — IP publique du serveur hardcodée dans le Dockerfile

- **Score : 4/10** | **CWE-215 (Insertion of Sensitive Information Into Debugging Code)**
- **Constat** : L'adresse IP `92.112.192.100` est hardcodée dans le `front.Dockerfile` (lignes 26 et 40). Cette IP est intégrée dans l'image Docker publiée sur Docker Hub (`sneaxiii/mawster-front`).
- **Impact** : Révélation de l'infrastructure, permet le ciblage direct du serveur, contournement éventuel de DNS/WAF.
- **Remédiation** : Passer cette valeur via une variable d'environnement à l'exécution, ne pas la builder dans l'image.
- Référence : [front/front.Dockerfile](front/front.Dockerfile#L26), [front/front.Dockerfile](front/front.Dockerfile#L40)

---

## 🟡 Vulnérabilités moyennes

### M-01 — Aucun rate limiting sur l'API (brute-force)

- **Score : 4/10** | **CWE-307 (Improper Restriction of Excessive Authentication Attempts)**
- **Constat** : Aucune bibliothèque de rate limiting n'est installée (`slowapi`, etc.) ni aucun middleware de throttling. Les endpoints `/auth/login`, `/auth/register`, `/user/reset-password` sont exploitables par brute-force.
- **Impact** : Attaque par force brute sur les mots de passe, création massive de comptes, DoS applicatif.
- **Remédiation** : Ajouter `slowapi` ou un rate limiter au niveau Caddy. Mettre un CAPTCHA sur l'inscription.
- Référence : [api/main.py](api/main.py#L24), [api/requirements.txt](api/requirements.txt)

### M-02 — Aucun header de sécurité HTTP (CSP, HSTS, X-Frame-Options)

- **Score : 4/10** | **CWE-693 (Protection Mechanism Failure)**
- **Constat** : Ni le front (Next.js), ni le reverse proxy (Caddy), ni l'API (FastAPI) ne définissent de headers de sécurité : pas de `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`.
- **Impact** : Pas de mitigation contre le clickjacking, le MIME sniffing, l'injection de ressources externes.
- **Remédiation** : Ajouter les headers dans le middleware Next.js ou dans le Caddyfile :
  ```
  header {
      X-Frame-Options DENY
      X-Content-Type-Options nosniff
      Referrer-Policy strict-origin-when-cross-origin
      Content-Security-Policy "default-src 'self'; script-src 'self'"
  }
  ```
- Référence : [Caddyfile](Caddyfile), [front/middleware.ts](front/middleware.ts)

### M-03 — JWT backend : seul `ExpiredSignatureError` est attrapé

- **Score : 5/10** | **CWE-755 (Improper Handling of Exceptional Conditions)**
- **Constat** : `JWTService.decode_jwt()` n'attrape que `ExpiredSignatureError`. Les exceptions `InvalidSignatureError`, `DecodeError`, `InvalidAlgorithmError` ne sont pas gérées et provoquent une erreur 500.
- **Impact** : Fuite d'informations via les stack traces, possibilité de DoS via des tokens malformés.
- **Remédiation** : Attraper `jwt.exceptions.PyJWTError` (classe parente) ou ajouter les exceptions spécifiques.
- Référence : [api/src/services/JWTService.py](api/src/services/JWTService.py#L48-L59)

### M-04 — Connexion DB sans TLS

- **Score : 5/10** | **CWE-319 (Cleartext Transmission)**
- **Constat** : La connection string MySQL (`mysql+aiomysql://...`) ne spécifie pas `ssl=True` ni de certificat CA. Le trafic DB circule en clair sur le réseau Docker interne.
- **Impact** : Risque faible en réseau Docker bridge isolé, mais critique si la DB est sur un hôte distant.
- **Remédiation** : Ajouter `?ssl=true` à la connection string ou configurer les certificats TLS dans les options de connexion.
- Référence : [api/src/utils/db.py](api/src/utils/db.py#L11-L14)

### M-05 — Pas de validation côté client sur l'inscription

- **Score : 5/10** | **CWE-20 (Improper Input Validation)**
- **Constat** : Le formulaire d'inscription n'a pas de validation Zod côté client (contrairement à l'article creation). L'email utilise `type="text"` au lieu de `type="email"`, contournant la validation native du navigateur. Pas de vérification de correspondance des mots de passe côté client.
- **Impact** : UX dégradée, requêtes inutiles vers l'API, possibilité de soumettre des données malformées.
- **Remédiation** : Ajouter un schéma Zod, utiliser `type="email"`, vérifier la correspondance des mots de passe avant soumission.
- Référence : [front/app/register/page.tsx](front/app/register/page.tsx)

### M-06 — Expiration du token NextAuth désynchronisée du backend

- **Score : 5/10** | **CWE-613 (Insufficient Session Expiration)**
- **Constat** : Le TTL du token côté NextAuth est hardcodé à 60 minutes (`Date.now() + 60 * 60 * 1000`) indépendamment du claim `exp` réel du JWT backend. Si le backend change son TTL, le front ne le saura pas.
- **Impact** : Le front peut considérer un token comme valide alors que le backend l'a déjà expiré (ou inversement), provoquant des erreurs 401 inattendues.
- **Remédiation** : Lire le claim `exp` du JWT décodé et l'utiliser comme `accessTokenExpires`.
- Référence : [front/app/api/auth/[...nextauth]/route.ts](front/app/api/auth/%5B...nextauth%5D/route.ts#L86)

### M-07 — Pas de mécanisme de refresh token

- **Score : 5/10** | **CWE-613 (Insufficient Session Expiration)**
- **Constat** : Quand le token expire, l'utilisateur est simplement marqué `expired: true` et redirigé vers `/login`. Pas de refresh token ni de renouvellement silencieux.
- **Impact** : Perte de contexte utilisateur toutes les 60 minutes, possible perte de données en cours de saisie.
- **Remédiation** : Implémenter un endpoint `/auth/refresh` côté API et un flow de refresh dans le callback JWT de NextAuth.
- Référence : [front/app/api/auth/[...nextauth]/route.ts](front/app/api/auth/%5B...nextauth%5D/route.ts#L88-L91)

### M-08 — Injection de paramètres HTTP dans les services front

- **Score : 5/10** | **CWE-88 (Improper Neutralization of Argument Delimiters)**
- **Constat** : Les fonctions de service front construisent les URLs par concaténation de strings (`?page=${page}&size=${size}&status=${status}&role=${role}`) sans encoder les paramètres.
- **Impact** : Si un paramètre contient `&extra=value`, il sera interprété comme un paramètre HTTP supplémentaire (HTTP Parameter Pollution).
- **Remédiation** : Utiliser `URLSearchParams` pour construire les query strings.
- Référence : [front/app/services/users.ts](front/app/services/users.ts)

### M-09 — Pas de CSRF sur les formulaires non-NextAuth

- **Score : 5/10** | **CWE-352 (Cross-Site Request Forgery)**
- **Constat** : Les formulaires d'inscription, de changement de mot de passe et de suppression de compte appellent directement l'API sans token CSRF. NextAuth protège uniquement son propre flow de login.
- **Impact** : Un site malveillant pourrait soumettre ces formulaires au nom d'un utilisateur connecté (si le navigateur envoie les cookies).
- **Facteur atténuant** : L'API utilise des Bearer tokens (pas de cookies), ce qui limite le risque.
- Référence : [front/app/register/page.tsx](front/app/register/page.tsx), [front/app/profile/page.tsx](front/app/profile/page.tsx)

### M-10 — Tabnabbing (`target="_blank"` sans `rel="noopener noreferrer"`)

- **Score : 5/10** | **CWE-1022 (Use of Web Link to Untrusted Target)**
- **Constat** : Les liens avec `target: '_blank'` sont configurés avec `openOnClick: true` mais sans `rel: 'noopener noreferrer'`.
- **Impact** : Une page ouverte via un lien dans un article peut accéder à `window.opener` et rediriger l'onglet original (tabnabbing).
- **Remédiation** : Ajouter `rel: 'noopener noreferrer'` dans les HTMLAttributes de l'extension Link.
- Référence : [front/app/ui/html-viewer/RichTextContent.tsx](front/app/ui/html-viewer/RichTextContent.tsx#L14-L20)

### M-11 — Sanitizer Bleach ne filtre pas les attributs `href` malveillants

- **Score : 5/10** | **CWE-79 (XSS)**
- **Constat** : Le sanitizer autorise le tag `<a>` mais la configuration `Cleaner` ne spécifie pas d'`attributes` whitelist. Par défaut, Bleach strip tous les attributs — ce qui signifie que `<a href="javascript:alert(1)">` deviendra `<a>` (sans href). C'est sûr **mais** cela casse les liens légitimes dans les articles.
- **Impact** : Pas de XSS (les attributs sont retirés), mais fonctionnalité brisée. Si un futur développeur ajoute `attributes={"a": ["href"]}` sans filtrer les protocoles, cela deviendrait une faille XSS.
- **Remédiation** : Ajouter explicitement `attributes={"a": ["href"]}` avec un filtre de protocoles (`bleach.sanitizer.ALLOWED_PROTOCOLS`).
- Référence : [api/src/utils/sanitizer.py](api/src/utils/sanitizer.py#L6-L31)

### M-12 — Le DTO `CreateArticle` n'a aucune validation

- **Score : 5/10** | **CWE-20 (Improper Input Validation)**
- **Constat** : Le DTO `CreateArticle` accepte un `title` (str) et un `content` (str) sans aucune contrainte de longueur, format ou contenu. Un titre de 10 millions de caractères serait accepté.
- **Impact** : DoS par soumission d'articles gigantesques, saturation de la base de données.
- **Remédiation** : Ajouter `Field(max_length=200)` pour le titre et `Field(max_length=100000)` pour le contenu.
- Référence : [api/src/dto/dto_articles.py](api/src/dto/dto_articles.py#L7-L10)

### M-13 — Pas de validation du paramètre `status` dans l'admin

- **Score : 5/10** | **CWE-20 (Improper Input Validation)**
- **Constat** : Le paramètre `status` dans `GET /admin/users` est un `Optional[str]` libre. Aucune validation contre un enum (`enabled`, `disabled`, `deleted`). Une valeur inattendue est simplement ignorée par `build_status_filter`, ce qui retourne tous les utilisateurs sans filtre.
- **Impact** : Bypass non-intentionnel du filtre de statut, extraction non filtrée de la liste des utilisateurs.
- **Remédiation** : Utiliser un `Enum` Pydantic ou `Literal["enabled", "disabled", "deleted"]` pour le paramètre.
- Référence : [api/src/controllers/admin_controller.py](api/src/controllers/admin_controller.py#L40), [api/src/services/UserService.py](api/src/services/UserService.py#L193-L201)

### M-14 — Mot de passe admin de fixture imprimé dans stdout

- **Score : 4/10** | **CWE-532 (Insertion of Sensitive Information into Log File)**
- **Constat** : `first_init_prod.py` affiche le mot de passe admin généré aléatoirement en clair dans la sortie standard : `print(f"⚠ Don't forget to update the master account {master_account} with the password {password_to_update}")`.
- **Impact** : Si les logs Docker sont accessibles (centralisés, partagés), le mot de passe admin initial est compromis.
- **Remédiation** : Écrire le mot de passe dans un fichier temporaire sécurisé ou obliger l'admin à le définir via variable d'environnement.
- Référence : [api/src/fixtures/first_init_prod.py](api/src/fixtures/first_init_prod.py#L84)

---

## 🟢 Vulnérabilités basses

### B-01 — Logs excessifs en production (backend)

- **Score : 6/10** | **CWE-532 (Information Exposure Through Log Files)**
- **Constat** : `icecream` (`ic()`) est utilisé pour logger la base de données ciblée (`ic(f"Targeted db: ...")`) et toutes les routes (`ic(app.routes)`) au démarrage, ainsi que chaque requête HTTP (`ic(f"Requested {method} {uri = }")`).
- **Remédiation** : Remplacer `ic()` par un logger structuré avec niveaux (DEBUG/INFO) et désactiver en production.
- Référence : [api/main.py](api/main.py#L22), [api/main.py](api/main.py#L41), [api/main.py](api/main.py#L80)

### B-02 — Logs excessifs en production (frontend)

- **Score : 6/10** | **CWE-532**
- **Constat** : Le middleware log le statut d'authentification sur chaque requête (`console.log('Token status:', ...)`). Les services front loggent les erreurs API complètes, les états de token, et les données de formulaires.
- **Remédiation** : Retirer les `console.log` ou les conditionner à `process.env.NODE_ENV !== 'production'`.
- Référence : [front/middleware.ts](front/middleware.ts#L18-L19)

### B-03 — Header `X-Process-Time` en réponse

- **Score : 7/10** | **CWE-200 (Information Exposure)**
- **Constat** : Le middleware API ajoute un header `X-Process-Time` à chaque réponse indiquant le temps de traitement.
- **Impact** : Permet le timing fingerprinting (un attaquant peut mesurer le temps de vérification bcrypt pour savoir si un compte existe).
- **Remédiation** : Retirer ce header en production.
- Référence : [api/main.py](api/main.py#L82)

### B-04 — Tests : mot de passe trivial en clair

- **Score : 8/10** | **CWE-798**
- **Constat** : Les fixtures de test utilisent `PASSWORD = "test"` et le hachent avec des rounds bcrypt bas. Risque de copier-coller en production.
- **Remédiation** : Documenter clairement que ces fixtures sont uniquement pour les tests.
- Référence : [api/src/fixtures/sample_data.py](api/src/fixtures/sample_data.py#L27)

### B-05 — Pas d'Error Boundary React

- **Score : 7/10** | **CWE-209 (Generation of Error Message Containing Sensitive Information)**
- **Constat** : Le layout racine n'a pas de composant `error.tsx` (convention Next.js App Router). Une erreur runtime non catchée affiche un écran blanc ou un stack trace en dev.
- **Remédiation** : Ajouter un fichier `app/error.tsx` et `app/global-error.tsx`.
- Référence : [front/app/layout.tsx](front/app/layout.tsx)

### B-06 — ID d'article non validé avant appel API (front)

- **Score : 7/10** | **CWE-20**
- **Constat** : Le paramètre `id` de la route `/articles/[id]` est passé directement à `fetch()` sans vérifier qu'il est numérique.
- **Remédiation** : Valider `id` avec une regex (`/^\d+$/`) avant l'appel API.
- Référence : [front/app/articles/[id]/page.tsx](front/app/articles/%5Bid%5D/page.tsx)

### B-07 — Volume Docker pour la DB persisté sur le host sans restrictions

- **Score : 7/10** | **CWE-276 (Incorrect Default Permissions)**
- **Constat** : Le volume `./data/db/` monte les données MariaDB directement sur le filesystem de l'hôte. Les permissions par défaut de MariaDB s'appliquent.
- **Remédiation** : Utiliser un volume Docker nommé au lieu d'un bind mount, ou restreindre les permissions du répertoire.
- Référence : [compose.yaml](compose.yaml#L13)

### B-08 — Watchtower avec accès au Docker socket

- **Score : 6/10** | **CWE-250 (Execution with Unnecessary Privileges)**
- **Constat** : Watchtower monte `/var/run/docker.sock` en lecture/écriture, ce qui donne un contrôle total sur le démon Docker (équivalent root sur l'hôte).
- **Remédiation** : Limiter Watchtower aux conteneurs nécessaires via labels (déjà en place) et envisager une alternative sans socket Docker.
- Référence : [compose.yaml](compose.yaml#L84)

### B-09 — Images Docker sans tag de version fixe

- **Score : 7/10** | **CWE-829 (Inclusion of Functionality from Untrusted Control Sphere)**
- **Constat** : Les images `mariadb`, `caddy:latest`, `phpmyadmin/phpmyadmin` sont référencées sans tag de version fixe (`latest` ou implicite). Une mise à jour automatique pourrait introduire des breaking changes ou des vulnérabilités.
- **Remédiation** : Fixer les versions : `mariadb:11.4`, `caddy:2.8`, etc.
- Référence : [compose.yaml](compose.yaml#L7), [compose.yaml](compose.yaml#L21), [compose.yaml](compose.yaml#L71)

### B-10 — Le endpoint `GET /` retourne des informations

- **Score : 8/10** | **CWE-200**
- **Constat** : `GET /` retourne `{"hello": "world"}`, confirmant que l'API est active et révélant la technologie (FastAPI avec ses headers par défaut).
- **Remédiation** : Retourner un 404 ou une réponse vide, ou retirer ce endpoint.
- Référence : [api/main.py](api/main.py#L112-L114)

---

## ℹ️ Informationnel

### I-01 — Pas de politique de rétention des `LoginLog`

- Les logs de connexion s'accumulent indéfiniment sans mécanisme de purge.
- Référence : [api/src/models/LoginLog.py](api/src/models/LoginLog.py)

### I-02 — `run_in_executor` avec `get_event_loop()` déprécié

- `asyncio.get_event_loop()` est déprécié depuis Python 3.10+. Utiliser `asyncio.get_running_loop()`.
- Référence : [api/src/services/PasswordService.py](api/src/services/PasswordService.py#L15), [api/src/utils/sanitizer.py](api/src/utils/sanitizer.py#L34)

### I-03 — `datetime.now()` sans timezone

- Les modèles utilisent `datetime.now` sans timezone info. Peut causer des incohérences si les serveurs sont dans des fuseaux différents.
- Référence : [api/src/models/User.py](api/src/models/User.py#L23), [api/src/models/LoginLog.py](api/src/models/LoginLog.py#L14)

### I-04 — `sentry-sdk` est dans les dépendances mais non configuré

- Sentry est installé mais aucun `sentry_sdk.init()` n'est présent dans le code. Pas de monitoring d'erreurs en production.
- Référence : [api/requirements.txt](api/requirements.txt#L47)

### I-05 — Pas de pagination par défaut sur `/articles` et `/categories`

- Les endpoints publics retournent tous les résultats sans limite, ce qui peut poser un problème de performance/DoS si la base grandit.
- Référence : [api/src/controllers/articles_controller.py](api/src/controllers/articles_controller.py#L15-L22)

### I-06 — Email de l'admin commité dans les fixtures

- L'email `misterbalise2@gmail.com` est hardcodé dans `first_init_prod.py`, ce qui le rend public dans le dépôt.
- Référence : [api/src/fixtures/first_init_prod.py](api/src/fixtures/first_init_prod.py#L22)

### I-07 — Port MariaDB exposé en mode dev

- Le `compose-dev.yaml` expose le port 3306 sur l'hôte (`ports: - 3306:3306`), rendant la DB accessible depuis le réseau local.
- Référence : [compose-dev.yaml](compose-dev.yaml#L8)

---

## Synthèse

### Tableau récapitulatif

| #   | Sév. | ID   | Titre                                             | Catégorie OWASP                           |
| --- | ---- | ---- | ------------------------------------------------- | ----------------------------------------- |
| 1   | 🔴   | C-01 | Secret NextAuth commité et identique dev/prod     | A07:2021 – Identification & Auth Failures |
| 2   | 🔴   | C-02 | CORS `*` avec credentials                         | A05:2021 – Security Misconfiguration      |
| 3   | 🔴   | C-03 | JWT décodé sans vérification de signature (front) | A07:2021 – Identification & Auth Failures |
| 4   | 🔴   | C-04 | Secrets API faibles par défaut                    | A05:2021 – Security Misconfiguration      |
| 5   | 🟠   | H-01 | XSS stocké via `dangerouslySetInnerHTML`          | A03:2021 – Injection                      |
| 6   | 🟠   | H-02 | Token API brut exposé côté client                 | A04:2021 – Insecure Design                |
| 7   | 🟠   | H-03 | Trafic HTTP non chiffré + HTTPS désactivé         | A02:2021 – Cryptographic Failures         |
| 8   | 🟠   | H-04 | Open redirect via `callbackUrl`                   | A01:2021 – Broken Access Control          |
| 9   | 🟠   | H-05 | phpMyAdmin exposé en production                   | A05:2021 – Security Misconfiguration      |
| 10  | 🟠   | H-06 | IP publique serveur dans Dockerfile               | A05:2021 – Security Misconfiguration      |
| 11  | 🟡   | M-01 | Aucun rate limiting (brute-force)                 | A07:2021 – Identification & Auth Failures |
| 12  | 🟡   | M-02 | Aucun header de sécurité HTTP                     | A05:2021 – Security Misconfiguration      |
| 13  | 🟡   | M-03 | JWT decode : gestion d'erreurs incomplète         | A07:2021 – Identification & Auth Failures |
| 14  | 🟡   | M-04 | Connexion DB sans TLS                             | A02:2021 – Cryptographic Failures         |
| 15  | 🟡   | M-05 | Pas de validation client sur l'inscription        | A03:2021 – Injection                      |
| 16  | 🟡   | M-06 | TTL token front désynchronisé du backend          | A07:2021 – Identification & Auth Failures |
| 17  | 🟡   | M-07 | Pas de refresh token                              | A07:2021 – Identification & Auth Failures |
| 18  | 🟡   | M-08 | HTTP Parameter Pollution (services front)         | A03:2021 – Injection                      |
| 19  | 🟡   | M-09 | Pas de CSRF sur formulaires non-NextAuth          | A01:2021 – Broken Access Control          |
| 20  | 🟡   | M-10 | Tabnabbing (target=\_blank)                       | A04:2021 – Insecure Design                |
| 21  | 🟡   | M-11 | Sanitizer Bleach sans whitelist d'attributs       | A03:2021 – Injection                      |
| 22  | 🟡   | M-12 | DTO CreateArticle sans contraintes                | A03:2021 – Injection                      |
| 23  | 🟡   | M-13 | Paramètre `status` admin non validé               | A03:2021 – Injection                      |
| 24  | 🟡   | M-14 | Mot de passe admin affiché dans les logs          | A09:2021 – Security Logging Failures      |
| 25  | 🟢   | B-01 | Logs excessifs backend (icecream)                 | A09:2021 – Security Logging Failures      |
| 26  | 🟢   | B-02 | Logs excessifs frontend (console.log)             | A09:2021 – Security Logging Failures      |
| 27  | 🟢   | B-03 | Header X-Process-Time (timing attack)             | A02:2021 – Cryptographic Failures         |
| 28  | 🟢   | B-04 | Mot de passe "test" dans les fixtures             | A07:2021 – Identification & Auth Failures |
| 29  | 🟢   | B-05 | Pas d'Error Boundary React                        | A05:2021 – Security Misconfiguration      |
| 30  | 🟢   | B-06 | ID article non validé côté front                  | A03:2021 – Injection                      |
| 31  | 🟢   | B-07 | Volume DB bind-mount sans restrictions            | A05:2021 – Security Misconfiguration      |
| 32  | 🟢   | B-08 | Watchtower avec Docker socket                     | A05:2021 – Security Misconfiguration      |
| 33  | 🟢   | B-09 | Images Docker sans version fixe                   | A06:2021 – Vulnerable Components          |
| 34  | 🟢   | B-10 | Endpoint GET / informatif                         | A05:2021 – Security Misconfiguration      |

### Statistiques

| Sévérité                      | Nombre |
| ----------------------------- | ------ |
| 🔴 Critique                   | 4      |
| 🟠 Haute                      | 6      |
| 🟡 Moyenne                    | 14     |
| 🟢 Basse                      | 10     |
| ℹ️ Info                       | 7      |
| **Total**                     | **41** |
| ✅ Points positifs identifiés | **14** |

### Score global de sécurité : **4.5 / 10**

---

## Recommandations prioritaires

### 🚨 Actions immédiates (avant mise en production)

1. **C-01** → Régénérer un secret NextAuth unique par environnement, ne jamais commiter de secret réel
2. **C-02** → Restreindre les origines CORS à la liste des domaines autorisés
3. **C-04** → Forcer les variables d'environnement obligatoires sans valeurs par défaut
4. **H-03** → Activer HTTPS dans Caddy (supprimer `auto_https off`)
5. **H-05** → Retirer phpMyAdmin en production

### ⚠️ Actions à court terme (sprint suivant)

6. **H-01** → Ajouter DOMPurify côté client comme défense en profondeur
7. **H-02** → Garder le token API côté serveur, utiliser un proxy API Next.js
8. **H-04** → Valider `callbackUrl` (chemin relatif uniquement)
9. **M-01** → Implémenter un rate limiter (`slowapi` ou Caddy `rate_limit`)
10. **M-02** → Ajouter les headers de sécurité HTTP (CSP, HSTS, X-Frame-Options)

### 📋 Actions à moyen terme

11. **M-03** → Compléter la gestion d'erreurs JWT backend
12. **M-12** → Ajouter des contraintes de longueur sur les DTOs
13. **M-07** → Implémenter un mécanisme de refresh token
14. **B-09** → Fixer les versions des images Docker
15. **I-04** → Configurer Sentry pour le monitoring d'erreurs en production
