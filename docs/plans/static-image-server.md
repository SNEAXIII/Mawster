# Plan : Serveur statique d'images (Nginx + auth_request)

## Contexte

Les images des champions sont stockées dans `api/static/champions/` et référencées via `Champion.image_url` (format `/static/champions/<nom>.png`). Objectif : les servir via un conteneur Nginx dédié, protégé par JWT pour limiter le scraping, compatible avec la migration future vers Docker Swarm + Traefik.

---

## Architecture cible

```
Browser
  │
  ├── GET /static/champions/spider-man.png
  │     + Authorization: Bearer <JWT>
  │
  ▼
Traefik  ──route /static/*──▶  static (Nginx)
                                    │
                                    ├── auth_request → FastAPI GET /auth/verify
                                    │       → 200 OK  (token valide → sert l'image)
                                    │       → 401     (bloqué)
                                    │
                                    ├── cache auth Nginx (TTL 1 min)
                                    ├── Cache-Control: max-age=2592000 (30 jours)
                                    └── PNG depuis /usr/share/nginx/html/static/
```

---

## Étapes

### 1. Déplacer les images

- Décider du dossier final des images (actuellement `api/static/`, à déplacer si besoin)
- Convention retenue : `static/champions/<nom>.png` à la racine du repo

### 2. Endpoint FastAPI `GET /auth/verify`

- Nouveau endpoint léger dans `api/src/controllers/`
- Valide le JWT via `Depends(AuthService.get_current_user_in_jwt)`
- Retourne `200 OK` si valide, lève `HTTPException(401)` sinon
- Pas de body en réponse (Nginx n'a besoin que du status code)

### 3. Dockerfile Nginx (`static.Dockerfile`)

```dockerfile
FROM nginx:alpine
COPY static/ /usr/share/nginx/html/static/
COPY nginx.conf /etc/nginx/nginx.conf
```

### 4. Configuration Nginx (`nginx.conf`)

Points clés :
- `location /auth/verify` → proxy vers l'API (interne, non exposé)
- `location /static/` → `auth_request /auth/verify`
- `proxy_cache_path` pour mettre en cache les réponses auth (TTL 1 min)
- `add_header Cache-Control "public, max-age=2592000"` sur les images
- Passer le header `Authorization` de la requête originale vers `auth_request`

### 5. compose-dev.yaml

Ajouter le service `static` :
```yaml
static:
  build:
    context: .
    dockerfile: static.Dockerfile
  ports:
    - "8002:80"
  depends_on:
    - api
```

### 6. compose-prod.yaml

Ajouter le service `static` avec labels Traefik (à compléter lors de la migration Swarm) :
```yaml
static:
  image: sneaxiii/mawster-static:latest
  depends_on:
    - api
  # labels Traefik : router /static/* → ce service
```

### 7. Frontend

- S'assurer que les requêtes vers `/static/*` incluent le header `Authorization: Bearer <JWT>`
- Vérifier dans `lib/apiClient` ou dans les composants Image Next.js

### 8. CI/CD

- Ajouter le build + push de `mawster-static` dans le pipeline GitHub Actions
- Watchtower détecte automatiquement la nouvelle image

---

## Notes

- Les images changent rarement (ajouts occasionnels de nouveaux champions)
- Rebuild de l'image Docker nécessaire à chaque ajout de champion
- Le cache navigateur de 30 jours est agressif — prévoir un versioning d'URL si une image change (ex: `?v=2`)
- Compatible Swarm : l'image est stateless, scalable horizontalement
