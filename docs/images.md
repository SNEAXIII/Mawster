# Images Docker — Build & Push

Build et push manuel des images depuis la machine de dev (la CI le fait automatiquement sur push vers `release`).

## API

```bash
docker build -t sneaxiii/mawster-api:latest -f api/api.Dockerfile ./api
docker push sneaxiii/mawster-api:latest
```

## Frontend

```bash
docker build -t sneaxiii/mawster-front:latest --build-arg NEXT_PUBLIC_API_CLIENT_HOST=https://www.mawster.app -f front/front.Dockerfile ./front
docker push sneaxiii/mawster-front:latest
```

## Migrate

```bash
docker build -t sneaxiii/mawster-migrate:latest -f api/migrate.Dockerfile api/
docker push sneaxiii/mawster-migrate:latest
```

## Backup

```bash
docker build -t sneaxiii/mawster-backup:latest -f backup/Dockerfile ./backup
docker push sneaxiii/mawster-backup:latest
```

## Pull sur le serveur

```bash
docker pull sneaxiii/mawster-api:latest
docker pull sneaxiii/mawster-front:latest
docker pull sneaxiii/mawster-migrate:latest
docker pull sneaxiii/mawster-backup:latest
```
