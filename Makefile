# Root Makefile — dev stack, Cypress UI, deploy + backup operations
.PHONY: help e2e-open e2e-db e2e-stop \
        backup-now backup-now-staging backup-list backup-list-staging backup-restore backup-restore-staging backup-restore-remote deploy db \
        migrate migrate-staging vision-up vision-down worker-up worker-logs db-dev db-dev-all panic db-access

NEXTAUTH_SECRET ?= e2e-local-nextauth-secret
NEXTAUTH_URL    ?= http://localhost:3000

ifeq ($(OS),Windows_NT)
# ── Windows (PowerShell) ─────────────────────────────────────────────────────
SHELL := powershell.exe
.SHELLFLAGS := -NoProfile -Command

# Une ligne de recette = un process powershell.exe (~0.5s). Les 30 lignes du help
# sont donc portees par une seule ligne de recette : le tableau est assemble ici,
# ou make consomme les backslash-newline (PowerShell ne connait pas ce marqueur de
# continuation, il utilise le backtick).
HELP_LINES := \
	"", \
	"=== Dev ===", \
	"db-dev                 --> demarrer la stack dev (rabbitmq + rustfs + postgres-dev + static)", \
	"db-dev-all             --> demarrer tous les services de compose-dev.yaml", \
	"vision-up              --> demarrer rabbitmq + rustfs (+ creation des buckets)", \
	"vision-down            --> arreter rabbitmq + rustfs", \
	"worker-up              --> (re)builder et demarrer le worker vision", \
	"worker-logs            --> suivre les logs du worker vision", \
	"all                    --> ouvrir tous les terminaux de dev (Windows Terminal)", \
	"", \
	"=== E2E (UI Cypress locale, la suite tourne en CI) ===", \
	"e2e-open               --> demarrer les services + ouvrir l'UI Cypress", \
	"e2e-db                 --> demarrer uniquement postgres-test", \
	"e2e-stop               --> arreter l'API et le frontend de test", \
	"Logs      : .e2e-api.log  .e2e-front.log", \
	"Variables : NEXTAUTH_SECRET=...", \
	"", \
	"=== Prod / Swarm ===", \
	"deploy                 --> builder les images et (re)demarrer tous les containers de production", \
	"panic                  --> retirer les stacks mawster / mawster-obs / mawster-staging", \
	"db-access              --> demarrer postgres + backup en prod (acces DB)", \
	"migrate                --> lancer les migrations Alembic via Docker Swarm (prod)", \
	"migrate-staging        --> lancer les migrations Alembic via Docker Swarm (staging)", \
	"seed-champions         --> charger le catalogue champions/masteries en prod (idempotent)", \
	"seed-champions-staging --> idem en staging", \
	"", \
	"=== Backup ===", \
	"backup-now             --> declencher un backup immediatement (prod)", \
	"backup-now-staging     --> declencher un backup manuel (staging, local only)", \
	"backup-list            --> lister les fichiers de backup locaux", \
	"backup-list-staging    --> lister les fichiers de backup staging locaux", \
	"backup-restore         --> restaurer depuis un backup local (FILE=mawster_YYYY-MM-DD_HH-MM.dump)", \
	"backup-restore-staging --> restaurer un backup local dans la staging (FILE=...)", \
	"backup-restore-remote  --> restaurer depuis Google Drive (FILE=mawster_YYYY-MM-DD_HH-MM.dump)", \
	""

help:
	@$(HELP_LINES) | ForEach-Object { Write-Host $$_ }

all:
	-taskkill /f /im node.exe
	-taskkill /f /im python.exe
	docker rm -f $$(docker ps -aq)
	wt -d "$$(pwd)" powershell -Command "make e2e-open"
	wt -d "$$(pwd)/api" powershell -Command "make run-dev"
	wt -d "$$(pwd)/api" powershell -Command "make run-testing"
	wt -d "$$(pwd)/front" powershell -Command "pnpm dev"
	wt -d "$$(pwd)/front" powershell -Command "pnpm testing"
	wt -d "$$(pwd)" powershell -Command "make db-dev"

e2e-stop:
	if (Test-Path .e2e-api.pid) { Stop-Process -Id (Get-Content .e2e-api.pid) -Force -ErrorAction SilentlyContinue; Remove-Item .e2e-api.pid -Force -ErrorAction SilentlyContinue }
	if (Test-Path .e2e-front.pid) { Stop-Process -Id (Get-Content .e2e-front.pid) -Force -ErrorAction SilentlyContinue; Remove-Item .e2e-front.pid -Force -ErrorAction SilentlyContinue }

e2e-open: e2e-db
	$$env:MODE = 'testing'; (Start-Process -PassThru -NoNewWindow -FilePath cmd -ArgumentList '/c uv run app_testing.py 2>&1' -WorkingDirectory api -RedirectStandardOutput ../.e2e-api.log).Id | Out-File -Encoding ascii .e2e-api.pid
	$$env:NEXTAUTH_SECRET = '$(NEXTAUTH_SECRET)'; $$env:NEXTAUTH_URL = '$(NEXTAUTH_URL)'; (Start-Process -PassThru -NoNewWindow -FilePath cmd -ArgumentList '/c pnpm testing 2>&1' -WorkingDirectory front -RedirectStandardOutput ../.e2e-front.log).Id | Out-File -Encoding ascii .e2e-front.pid
	@echo 'Attente de l API (port 8001)...'; for ($$i = 0; $$i -lt 30; $$i++) { if ((Test-NetConnection -ComputerName localhost -Port 8001 -WarningAction SilentlyContinue).TcpTestSucceeded) { break }; Start-Sleep 2 }
	@echo 'Attente du frontend (port 3001)...'; for ($$i = 0; $$i -lt 60; $$i++) { if ((Test-NetConnection -ComputerName localhost -Port 3001 -WarningAction SilentlyContinue).TcpTestSucceeded) { break }; Start-Sleep 2 }
	@echo 'Lancement de Cypress...'; Set-Location front; pnpm exec cypress open

backup-list:
	Get-ChildItem backups\mawster_*.dump -ErrorAction SilentlyContinue | Select-Object Length,Name | Format-Table -AutoSize; if (-not (Test-Path 'backups\mawster_*.dump')) { Write-Host '(no local backups)' }

backup-restore:
	if (-not '$(FILE)') { Write-Host 'Usage: make backup-restore FILE=mawster_YYYY-MM-DD_HH-MM.dump'; exit 1 }; docker exec backup /usr/local/bin/restore.sh $(FILE)

backup-restore-remote:
	if (-not '$(FILE)') { Write-Host 'Usage: make backup-restore-remote FILE=mawster_YYYY-MM-DD_HH-MM.dump'; exit 1 }; docker exec backup /usr/local/bin/restore.sh --remote $(FILE)

backup-list-staging:
	Get-ChildItem backups-staging\mawster_*.sql.gz -ErrorAction SilentlyContinue | Select-Object Length,Name | Format-Table -AutoSize; if (-not (Test-Path 'backups-staging\mawster_*.sql.gz')) { Write-Host '(no local backups)' }

backup-restore-staging:
	if (-not '$(FILE)') { Write-Host 'Usage: make backup-restore-staging FILE=mawster-staging_YYYY-MM-DD_HH-MM.sql.gz'; exit 1 }; $$id = (docker ps -q -f name=mawster-staging_backup | Select-Object -First 1); if (-not $$id) { Write-Host 'container mawster-staging_backup introuvable'; exit 1 }; docker exec $$id /usr/local/bin/restore.sh $(FILE)

backup-now:
	$$id = (docker ps -q -f name=mawster_backup | Select-Object -First 1); if (-not $$id) { Write-Host 'container mawster_backup introuvable'; exit 1 }; docker exec $$id /usr/local/bin/backup.sh

backup-now-staging:
	$$id = (docker ps -q -f name=mawster-staging_backup | Select-Object -First 1); if (-not $$id) { Write-Host 'container mawster-staging_backup introuvable'; exit 1 }; docker exec $$id /usr/local/bin/backup.sh

else
# ── Linux / macOS ─────────────────────────────────────────────────────────────

help:
	@echo "" ; \
	echo "=== Dev ===" ; \
	echo "db-dev                 --> demarrer la stack dev (rabbitmq + rustfs + postgres-dev + static)" ; \
	echo "db-dev-all             --> demarrer tous les services de compose-dev.yaml" ; \
	echo "vision-up              --> demarrer rabbitmq + rustfs (+ creation des buckets)" ; \
	echo "vision-down            --> arreter rabbitmq + rustfs" ; \
	echo "worker-up              --> (re)builder et demarrer le worker vision" ; \
	echo "worker-logs            --> suivre les logs du worker vision" ; \
	echo "" ; \
	echo "=== E2E (UI Cypress locale, la suite tourne en CI) ===" ; \
	echo "e2e-open               --> demarrer les services + ouvrir l'UI Cypress" ; \
	echo "e2e-db                 --> demarrer uniquement postgres-test" ; \
	echo "e2e-stop               --> arreter l'API et le frontend de test" ; \
	echo "Logs      : .e2e-api.log  .e2e-front.log" ; \
	echo "Variables : NEXTAUTH_SECRET=..." ; \
	echo "" ; \
	echo "=== Prod / Swarm ===" ; \
	echo "deploy                 --> builder les images et (re)demarrer tous les containers de production" ; \
	echo "panic                  --> retirer les stacks mawster / mawster-obs / mawster-staging" ; \
	echo "db-access              --> demarrer postgres + backup en prod (acces DB)" ; \
	echo "migrate                --> lancer les migrations Alembic via Docker Swarm (prod)" ; \
	echo "migrate-staging        --> lancer les migrations Alembic via Docker Swarm (staging)" ; \
	echo "seed-champions         --> charger le catalogue champions/masteries en prod (idempotent)" ; \
	echo "seed-champions-staging --> idem en staging" ; \
	echo "" ; \
	echo "=== Backup ===" ; \
	echo "backup-now             --> declencher un backup immediatement (prod)" ; \
	echo "backup-now-staging     --> declencher un backup manuel (staging, local only)" ; \
	echo "backup-list            --> lister les fichiers de backup locaux" ; \
	echo "backup-list-staging    --> lister les fichiers de backup staging locaux" ; \
	echo "backup-restore         --> restaurer depuis un backup local (FILE=mawster_YYYY-MM-DD_HH-MM.dump)" ; \
	echo "backup-restore-staging --> restaurer un backup local dans la staging (FILE=mawster-staging_YYYY-MM-DD_HH-MM.sql.gz)" ; \
	echo "backup-restore-remote  --> restaurer depuis Google Drive (FILE=mawster_YYYY-MM-DD_HH-MM.dump)" ; \
	echo ""

e2e-stop:
	@if [ -f .e2e-api.pid ]; then \
		kill $$(cat .e2e-api.pid) 2>/dev/null || true; \
		rm -f .e2e-api.pid; \
	fi
	@if [ -f .e2e-front.pid ]; then \
		kill $$(cat .e2e-front.pid) 2>/dev/null || true; \
		rm -f .e2e-front.pid; \
	fi

e2e-open: e2e-db
	cd api && MODE=testing uv run app_testing.py > /dev/null 2>&1 & echo $$! > .e2e-api.pid
	cd front && NEXTAUTH_SECRET=$(NEXTAUTH_SECRET) NEXTAUTH_URL=$(NEXTAUTH_URL) pnpm testing > /dev/null 2>&1 & echo $$! > .e2e-front.pid
	@echo "Attente de l'API (port 8001)..."; \
	for i in $$(seq 1 30); do curl -s http://localhost:8001 >/dev/null 2>&1 && break || sleep 2; done
	@echo "Attente du frontend (port 3001)..."; \
	for i in $$(seq 1 60); do curl -s http://localhost:3001 >/dev/null 2>&1 && break || sleep 2; done
	@echo "Lancement de Cypress..."
	(cd front && pnpm exec cypress open)

backup-list:
	ls -lh backups/mawster_*.dump 2>/dev/null || echo "(no local backups)"

backup-list-staging:
	ls -lh backups-staging/mawster_*.sql.gz 2>/dev/null || echo "(no local backups)"

backup-restore:
	@test -n "$(FILE)" || (echo "Usage: make backup-restore FILE=mawster_YYYY-MM-DD_HH-MM.dump" && exit 1)
	docker exec $$(docker ps -q -f name=mawster_backup) /usr/local/bin/restore.sh $(FILE)

backup-restore-remote:
	@test -n "$(FILE)" || (echo "Usage: make backup-restore-remote FILE=mawster_YYYY-MM-DD_HH-MM.dump" && exit 1)
	docker exec $$(docker ps -q -f name=mawster_backup) /usr/local/bin/restore.sh --remote $(FILE)

backup-restore-staging:
	@test -n "$(FILE)" || (echo "Usage: make backup-restore-staging FILE=mawster-staging_YYYY-MM-DD_HH-MM.sql.gz" && exit 1)
	docker exec $$(docker ps -q -f name=mawster-staging_backup) /usr/local/bin/restore.sh $(FILE)

backup-now:
	docker exec $$(docker ps -q -f name=mawster_backup) /usr/local/bin/backup.sh

backup-now-staging:
	docker exec $$(docker ps -q -f name=mawster-staging_backup) /usr/local/bin/backup.sh

endif

e2e-db:
	docker compose -f compose-dev.yaml up postgres-test -d

vision-up:
	docker compose -f compose-dev.yaml up -d rabbitmq rustfs
	docker compose -f compose-dev.yaml run --rm rustfs-init

vision-down:
	docker compose -f compose-dev.yaml stop rabbitmq rustfs

worker-up: vision-up
	docker compose -f compose-dev.yaml up -d --build vision-worker

worker-logs:
	docker compose -f compose-dev.yaml logs -f vision-worker

migrate:
	docker service rm mawster-migrate 2>/dev/null || true
	docker service create \
		--name mawster-migrate \
		--network internal \
		--secret mawster_db_password \
		-e POSTGRES_USER=mawster \
		-e POSTGRES_PORT=5432 \
		-e POSTGRES_DB=mawster \
		--mode replicated-job \
		sneaxiii/mawster-migrate:latest sh migrate.sh
	docker service logs -f mawster-migrate
	@docker service ps mawster-migrate --format "{{.CurrentState}}" | grep -q "^Failed" && \
		(docker service rm mawster-migrate; exit 1) || docker service rm mawster-migrate

migrate-staging:
	docker service rm mawster-migrate-staging 2>/dev/null || true
	docker service create \
		--name mawster-migrate-staging \
		--network internal-staging \
		--secret source=mawster_db_password_staging,target=mawster_db_password \
		--secret source=mawster_db_root_password_staging,target=mawster_db_root_password \
		-e MARIADB_USER=mawster \
		-e MARIADB_PORT=3306 \
		-e MARIADB_DATABASE=mawster \
		--mode replicated-job \
		sneaxiii/mawster-migrate:staging sh migrate.sh
	docker service logs -f mawster-migrate-staging
	@docker service ps mawster-migrate-staging --format "{{.CurrentState}}" | grep -q "^Failed" && \
		(docker service rm mawster-migrate-staging; exit 1) || docker service rm mawster-migrate-staging

# Exec into the api container: it has the secrets mounted, which a
# standalone job lacks. start-first keeps the old container running, hence
# the ancestor filter and the poll.
SEED_CMD = uv run --no-build --no-sync python -m src.fixtures.load_champions && uv run --no-build --no-sync python -m src.fixtures.load_masteries
.PHONY: seed-champions seed-champions-staging
seed-champions:
	@CID=""; \
	for i in $$(seq 1 30); do \
		CID=$$(docker ps -q -f name=mawster_api -f status=running -f ancestor=sneaxiii/mawster-api:latest | head -n1); \
		[ -n "$$CID" ] && break; \
		sleep 2; \
	done; \
	if [ -z "$$CID" ]; then \
		echo "seed-champions: no running mawster_api container found after 60s" >&2; \
		exit 1; \
	fi; \
	docker exec $$CID sh -c "$(SEED_CMD)"

seed-champions-staging:
	@CID=""; \
	for i in $$(seq 1 30); do \
		CID=$$(docker ps -q -f name=mawster-staging_api -f status=running -f ancestor=sneaxiii/mawster-api:staging | head -n1); \
		[ -n "$$CID" ] && break; \
		sleep 2; \
	done; \
	if [ -z "$$CID" ]; then \
		echo "seed-champions-staging: no running mawster-staging_api container found after 60s" >&2; \
		exit 1; \
	fi; \
	docker exec $$CID sh -c "$(SEED_CMD)"

deploy:
	docker pull sneaxiii/mawster-api:latest
	docker pull sneaxiii/mawster-migrate:latest
	docker pull sneaxiii/mawster-front:latest
	docker pull sneaxiii/mawster-backup:latest
	docker pull sneaxiii/mawster-static:latest
	docker pull sneaxiii/mawster-vision-worker:latest
# 	docker stack deploy --with-registry-auth --resolve-image always -c stack-obs.yaml mawster-obs
	docker stack deploy --with-registry-auth --resolve-image always -c stack-app.yaml mawster
# 	docker stack deploy --with-registry-auth --resolve-image always -c stack-app-staging.yaml mawster-staging

panic:
	docker stack rm mawster
	docker stack rm mawster-obs
	docker stack rm mawster-staging

db-access:
	docker compose -f compose-prod.yaml -f compose-prod.yaml -f compose-db-access.yaml up postgres backup -d

db-dev:
	docker compose -f compose-dev.yaml up -d --build postgres-dev static

db-dev-all:
	docker compose -f compose-dev.yaml up -d --build
