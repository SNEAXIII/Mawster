# Root Makefile — E2E test orchestration + backup operations
.PHONY: help e2e e2e-open e2e-parallel e2e-parallel-quiet e2e-db e2e-stop \
        backup-now backup-now-staging backup-list backup-list-staging backup-restore backup-restore-staging backup-restore-remote deploy db \
        migrate migrate-staging vision-up vision-down worker-up worker-logs db-dev db-dev-all panic db-access

NEXTAUTH_SECRET ?= e2e-local-nextauth-secret
NEXTAUTH_URL    ?= http://localhost:3000
SPEC            ?=

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
	"db-dev                 --> demarrer la stack dev (rabbitmq + rustfs + mariadb-dev + static)", \
	"db-dev-all             --> demarrer tous les services de compose-dev.yaml", \
	"vision-up              --> demarrer rabbitmq + rustfs (+ creation des buckets)", \
	"vision-down            --> arreter rabbitmq + rustfs", \
	"worker-up              --> (re)builder et demarrer le worker vision", \
	"worker-logs            --> suivre les logs du worker vision", \
	"all                    --> ouvrir tous les terminaux de dev (Windows Terminal)", \
	"", \
	"=== E2E ===", \
	"e2e                    --> demarrer les services + lancer Cypress headless", \
	"e2e-open               --> demarrer les services + ouvrir l'UI Cypress", \
	"e2e-parallel           --> lancer les tests E2E en parallele (N=3 par defaut, max 8)", \
	"e2e-parallel-quiet     --> lancer les tests E2E en parallele en mode silencieux", \
	"e2e-db                 --> demarrer uniquement mariadb-test", \
	"e2e-stop               --> arreter l'API et le frontend de test", \
	"Logs      : .e2e-api.log  .e2e-front.log", \
	"Variables : N=4  SPEC=war/war-management.cy.ts  Q=1  NEXTAUTH_SECRET=...", \
	"", \
	"=== Prod / Swarm ===", \
	"deploy                 --> builder les images et (re)demarrer tous les containers de production", \
	"panic                  --> retirer les stacks mawster / mawster-obs / mawster-staging", \
	"db-access              --> demarrer mariadb + backup en prod (acces DB)", \
	"migrate                --> lancer les migrations Alembic via Docker Swarm (prod)", \
	"migrate-staging        --> lancer les migrations Alembic via Docker Swarm (staging)", \
	"seed-champions         --> charger le catalogue champions/masteries en prod (idempotent)", \
	"seed-champions-staging --> idem en staging", \
	"", \
	"=== Backup ===", \
	"backup-now             --> declencher un backup immediatement (prod)", \
	"backup-now-staging     --> declencher un backup manuel (staging, local only)", \
	"backup-list            --> lister les fichiers de backup locaux", \
	"backup-restore         --> restaurer depuis un backup local (FILE=mawster_YYYY-MM-DD_HH-MM.sql.gz)", \
	"backup-restore-staging --> restaurer un backup local dans la staging (FILE=...)", \
	"backup-restore-remote  --> restaurer depuis Google Drive (FILE=mawster_YYYY-MM-DD_HH-MM.sql.gz)", \
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
	wt -d "$$(pwd)/front" powershell -Command "npm run dev"
	wt -d "$$(pwd)/front" powershell -Command "npm run testing"
	wt -d "$$(pwd)" powershell -Command "make db-dev"

e2e-stop:
	if (Test-Path .e2e-api.pid) { Stop-Process -Id (Get-Content .e2e-api.pid) -Force -ErrorAction SilentlyContinue; Remove-Item .e2e-api.pid -Force -ErrorAction SilentlyContinue }
	if (Test-Path .e2e-front.pid) { Stop-Process -Id (Get-Content .e2e-front.pid) -Force -ErrorAction SilentlyContinue; Remove-Item .e2e-front.pid -Force -ErrorAction SilentlyContinue }

e2e: e2e-db
	$$env:MODE = 'testing'; (Start-Process -PassThru -NoNewWindow -FilePath cmd -ArgumentList '/c uv run app_testing.py 2>&1' -WorkingDirectory api -RedirectStandardOutput ../.e2e-api.log).Id | Out-File -Encoding ascii .e2e-api.pid
	$$env:NEXTAUTH_SECRET = '$(NEXTAUTH_SECRET)'; $$env:NEXTAUTH_URL = '$(NEXTAUTH_URL)'; (Start-Process -PassThru -NoNewWindow -FilePath cmd -ArgumentList '/c npm run testing 2>&1' -WorkingDirectory front -RedirectStandardOutput ../.e2e-front.log).Id | Out-File -Encoding ascii .e2e-front.pid
	@echo 'Attente de l API (port 8001)...'; for ($$i = 0; $$i -lt 30; $$i++) { if ((Test-NetConnection -ComputerName localhost -Port 8001 -WarningAction SilentlyContinue).TcpTestSucceeded) { break }; Start-Sleep 2 }
	@echo 'Attente du frontend (port 3001)...'; for ($$i = 0; $$i -lt 60; $$i++) { if ((Test-NetConnection -ComputerName localhost -Port 3001 -WarningAction SilentlyContinue).TcpTestSucceeded) { break }; Start-Sleep 2 }
	@echo 'Lancement de Cypress...'; Set-Location front; npx cypress run $(if $(SPEC),--spec $(SPEC),); $$EXIT = $$LASTEXITCODE; Set-Location ..; if (Test-Path .e2e-api.pid) { Stop-Process -Id (Get-Content .e2e-api.pid) -Force -EA SilentlyContinue; Remove-Item .e2e-api.pid -Force -EA SilentlyContinue }; if (Test-Path .e2e-front.pid) { Stop-Process -Id (Get-Content .e2e-front.pid) -Force -EA SilentlyContinue; Remove-Item .e2e-front.pid -Force -EA SilentlyContinue }; exit $$EXIT

e2e-open: e2e-db
	$$env:MODE = 'testing'; (Start-Process -PassThru -NoNewWindow -FilePath cmd -ArgumentList '/c uv run app_testing.py 2>&1' -WorkingDirectory api -RedirectStandardOutput ../.e2e-api.log).Id | Out-File -Encoding ascii .e2e-api.pid
	$$env:NEXTAUTH_SECRET = '$(NEXTAUTH_SECRET)'; $$env:NEXTAUTH_URL = '$(NEXTAUTH_URL)'; (Start-Process -PassThru -NoNewWindow -FilePath cmd -ArgumentList '/c npm run testing 2>&1' -WorkingDirectory front -RedirectStandardOutput ../.e2e-front.log).Id | Out-File -Encoding ascii .e2e-front.pid
	@echo 'Attente de l API (port 8001)...'; for ($$i = 0; $$i -lt 30; $$i++) { if ((Test-NetConnection -ComputerName localhost -Port 8001 -WarningAction SilentlyContinue).TcpTestSucceeded) { break }; Start-Sleep 2 }
	@echo 'Attente du frontend (port 3001)...'; for ($$i = 0; $$i -lt 60; $$i++) { if ((Test-NetConnection -ComputerName localhost -Port 3001 -WarningAction SilentlyContinue).TcpTestSucceeded) { break }; Start-Sleep 2 }
	@echo 'Lancement de Cypress...'; Set-Location front; npx cypress open

e2e-parallel: e2e-db
	python scripts/e2e_parallel.py --workers $(if $(N),$(N),3) $(if $(SPEC),--spec $(SPEC),) $(if $(Q),--quiet,)

e2e-parallel-quiet: e2e-db
	python scripts/e2e_parallel.py --workers $(if $(N),$(N),3) $(if $(SPEC),--spec $(SPEC),) --quiet

backup-list:
	Get-ChildItem backups\mawster_*.sql.gz -ErrorAction SilentlyContinue | Select-Object Length,Name | Format-Table -AutoSize; if (-not (Test-Path 'backups\mawster_*.sql.gz')) { Write-Host '(no local backups)' }

backup-restore:
	if (-not '$(FILE)') { Write-Host 'Usage: make backup-restore FILE=mawster_YYYY-MM-DD_HH-MM.sql.gz'; exit 1 }; $$pass = (Select-String 'MARIADB_ROOT_PASSWORD' db.env).Line.Split('=')[1]; docker exec -e "MARIADB_ROOT_PASSWORD=$$pass" backup /usr/local/bin/restore.sh $(FILE)

backup-restore-remote:
	if (-not '$(FILE)') { Write-Host 'Usage: make backup-restore-remote FILE=mawster_YYYY-MM-DD_HH-MM.sql.gz'; exit 1 }; $$pass = (Select-String 'MARIADB_ROOT_PASSWORD' db.env).Line.Split('=')[1]; docker exec -e "MARIADB_ROOT_PASSWORD=$$pass" backup /usr/local/bin/restore.sh --remote $(FILE)

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
	echo "db-dev                 --> demarrer la stack dev (rabbitmq + rustfs + mariadb-dev + static)" ; \
	echo "db-dev-all             --> demarrer tous les services de compose-dev.yaml" ; \
	echo "vision-up              --> demarrer rabbitmq + rustfs (+ creation des buckets)" ; \
	echo "vision-down            --> arreter rabbitmq + rustfs" ; \
	echo "worker-up              --> (re)builder et demarrer le worker vision" ; \
	echo "worker-logs            --> suivre les logs du worker vision" ; \
	echo "" ; \
	echo "=== E2E ===" ; \
	echo "e2e                    --> demarrer les services + lancer Cypress headless" ; \
	echo "e2e-open               --> demarrer les services + ouvrir l'UI Cypress" ; \
	echo "e2e-parallel           --> lancer les tests E2E en parallele (N=4 par defaut, max 8)" ; \
	echo "e2e-parallel-quiet     --> lancer les tests E2E en parallele en mode silencieux" ; \
	echo "e2e-db                 --> demarrer uniquement mariadb-test" ; \
	echo "e2e-stop               --> arreter l'API et le frontend de test" ; \
	echo "Logs      : .e2e-api.log  .e2e-front.log" ; \
	echo "Variables : N=4  SPEC=war/war-management.cy.ts  Q=1  NEXTAUTH_SECRET=..." ; \
	echo "" ; \
	echo "=== Tier dev public (stack Swarm mawster-dev) ===" ; \
	echo "dev-build              --> builder les images api/migrate/front/static en :local" ; \
	echo "dev-up                 --> builder puis deployer le stack mawster-dev" ; \
	echo "dev-down               --> retirer le stack mawster-dev" ; \
	echo "dev-migrate            --> lancer les migrations Alembic sur le stack mawster-dev" ; \
	echo "dev-seed               --> wipe + seed (champions, masteries, sample data)" ; \
	echo "dev-nuke               --> dev-down + suppression du volume de DB" ; \
	echo "dev-logs               --> suivre les logs de l'API du stack mawster-dev" ; \
	echo "" ; \
	echo "=== Prod / Swarm ===" ; \
	echo "deploy                 --> builder les images et (re)demarrer tous les containers de production" ; \
	echo "panic                  --> retirer les stacks mawster / mawster-obs / mawster-staging" ; \
	echo "db-access              --> demarrer mariadb + backup en prod (acces DB)" ; \
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
	echo "backup-restore         --> restaurer depuis un backup local (FILE=mawster_YYYY-MM-DD_HH-MM.sql.gz)" ; \
	echo "backup-restore-staging --> restaurer un backup local dans la staging (FILE=mawster-staging_YYYY-MM-DD_HH-MM.sql.gz)" ; \
	echo "backup-restore-remote  --> restaurer depuis Google Drive (FILE=mawster_YYYY-MM-DD_HH-MM.sql.gz)" ; \
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

e2e: e2e-db
	cd api && MODE=testing uv run app_testing.py > /dev/null 2>&1 & echo $$! > .e2e-api.pid
	cd front && NEXTAUTH_SECRET=$(NEXTAUTH_SECRET) NEXTAUTH_URL=$(NEXTAUTH_URL) npm run testing > /dev/null 2>&1 & echo $$! > .e2e-front.pid
	@echo "Attente de l'API (port 8001)..."; \
	for i in $$(seq 1 30); do curl -s http://localhost:8001 >/dev/null 2>&1 && break || sleep 2; done
	@echo "Attente du frontend (port 3001)..."; \
	for i in $$(seq 1 60); do curl -s http://localhost:3001 >/dev/null 2>&1 && break || sleep 2; done
	@echo "Lancement de Cypress..."
	(cd front && npx cypress run $(if $(SPEC),--spec $(SPEC),)); STATUS=$$?; $(MAKE) e2e-stop; exit $$STATUS

e2e-open: e2e-db
	cd api && MODE=testing uv run app_testing.py > /dev/null 2>&1 & echo $$! > .e2e-api.pid
	cd front && NEXTAUTH_SECRET=$(NEXTAUTH_SECRET) NEXTAUTH_URL=$(NEXTAUTH_URL) npm run testing > /dev/null 2>&1 & echo $$! > .e2e-front.pid
	@echo "Attente de l'API (port 8001)..."; \
	for i in $$(seq 1 30); do curl -s http://localhost:8001 >/dev/null 2>&1 && break || sleep 2; done
	@echo "Attente du frontend (port 3001)..."; \
	for i in $$(seq 1 60); do curl -s http://localhost:3001 >/dev/null 2>&1 && break || sleep 2; done
	@echo "Lancement de Cypress..."
	(cd front && npx cypress open)

e2e-parallel: e2e-db ## Run E2E tests in parallel (N=4 by default, max 8)
	python3 scripts/e2e_parallel.py --workers $(if $(N),$(N),4) $(if $(SPEC),--spec $(SPEC),) $(if $(Q),--quiet,)

e2e-parallel-quiet: e2e-db ## Run E2E tests in parallel, hide server logs (N=4 by default, max 8)
	python3 scripts/e2e_parallel.py --workers $(if $(N),$(N),4) $(if $(SPEC),--spec $(SPEC),) --quiet

backup-list:
	ls -lh backups/mawster_*.sql.gz 2>/dev/null || echo "(no local backups)"

backup-list-staging:
	ls -lh backups-staging/mawster_*.sql.gz 2>/dev/null || echo "(no local backups)"

backup-restore:
	@test -n "$(FILE)" || (echo "Usage: make backup-restore FILE=mawster_YYYY-MM-DD_HH-MM.sql.gz" && exit 1)
	docker exec -e MARIADB_ROOT_PASSWORD="$$(grep MARIADB_ROOT_PASSWORD db.env | cut -d= -f2)" \
		$$(docker ps -q -f name=mawster_backup) /usr/local/bin/restore.sh $(FILE)

backup-restore-remote:
	@test -n "$(FILE)" || (echo "Usage: make backup-restore-remote FILE=mawster_YYYY-MM-DD_HH-MM.sql.gz" && exit 1)
	docker exec -e MARIADB_ROOT_PASSWORD="$$(grep MARIADB_ROOT_PASSWORD db.env | cut -d= -f2)" \
		$$(docker ps -q -f name=mawster_backup) /usr/local/bin/restore.sh --remote $(FILE)

backup-restore-staging:
	@test -n "$(FILE)" || (echo "Usage: make backup-restore-staging FILE=mawster-staging_YYYY-MM-DD_HH-MM.sql.gz" && exit 1)
	docker exec $$(docker ps -q -f name=mawster-staging_backup) /usr/local/bin/restore.sh $(FILE)

backup-now:
	docker exec $$(docker ps -q -f name=mawster_backup) /usr/local/bin/backup.sh

backup-now-staging:
	docker exec $$(docker ps -q -f name=mawster-staging_backup) /usr/local/bin/backup.sh

# ===== Tier dev public (stack Swarm mawster-dev) =====
.PHONY: dev-build dev-up dev-down dev-migrate dev-seed dev-reset dev-nuke dev-logs
DEV_STACK := mawster-dev
DEV_ENV   := stack-app-dev.env
DEV_NET   := $(DEV_STACK)_internal-dev

dev-build:
	docker build -t mawster-api-dev:local -f api/api.Dockerfile api
	docker build -t mawster-migrate-dev:local -f api/migrate.Dockerfile api
	docker build -t mawster-front-dev:local -f front/front.Dockerfile front
	docker build -t mawster-static-dev:local -f static-assets/static.Dockerfile .

dev-up: dev-build
	set -a; . ./$(DEV_ENV); set +a; \
	docker stack deploy --resolve-image never -c stack-app-dev.yaml $(DEV_STACK)

dev-down:
	docker stack rm $(DEV_STACK)

dev-migrate:
	set -a; . ./$(DEV_ENV); set +a; \
	docker service rm $(DEV_STACK)-migrate 2>/dev/null || true; \
	docker service create --name $(DEV_STACK)-migrate --network $(DEV_NET) \
	  -e MARIADB_USER=mawster -e MARIADB_PORT=3306 -e MARIADB_DATABASE=mawster \
	  -e MARIADB_PASSWORD="$$MARIADB_PASSWORD" \
	  --mode replicated-job mawster-migrate-dev:local sh migrate.sh; \
	docker service logs $(DEV_STACK)-migrate; \
	docker service rm $(DEV_STACK)-migrate

# Repopulate complet (wipe + seed), équivalent du `repopulate-db` de api/Makefile.
dev-seed:
	docker exec $$(docker ps -q -f name=$(DEV_STACK)_api | head -n1) \
	  sh -c 'uv run --no-sync python -m src.fixtures.reset_db && \
	         uv run --no-sync python -m src.fixtures.load_champions && \
	         uv run --no-sync python -m src.fixtures.load_masteries && \
	         uv run --no-sync python -m src.fixtures.sample_data'

dev-reset: dev-seed

dev-nuke: dev-down
	@echo "Attente du retrait du stack..."; sleep 5
	docker volume rm $(DEV_STACK)_data_db_dev 2>/dev/null || true

dev-logs:
	docker service logs -f $(DEV_STACK)_api

endif

e2e-db:
	docker compose -f compose-dev.yaml up mariadb-test -d

vision-up:
	docker compose -f compose-dev.yaml up -d rabbitmq rustfs
	docker compose -f compose-dev.yaml run --rm rustfs-init

vision-down:
	docker compose -f compose-dev.yaml stop rabbitmq rustfs

worker-up:
	docker compose -f compose-dev.yaml up -d --build vision-worker

worker-logs:
	docker compose -f compose-dev.yaml logs -f vision-worker

migrate:
	docker service rm mawster-migrate 2>/dev/null || true
	docker service create \
		--name mawster-migrate \
		--network internal \
		--secret mawster_db_password \
		--secret mawster_db_root_password \
		-e MARIADB_USER=mawster \
		-e MARIADB_PORT=3306 \
		-e MARIADB_DATABASE=mawster \
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

# Champion + mastery catalogue. Runs inside the already-running api container
# rather than a standalone Swarm job: SECRET (api/src/security/secrets.py) is
# a pydantic Settings built at import time. With MODE=prod, fourteen fields
# become required (SECRET_KEY, ALLOWED_ORIGINS, EMAIL_PEPPER, RABBITMQ_URL,
# RUSTFS_*, API_PORT, the token expiries...) so a bare `Settings()` raises
# before any query runs. A `docker exec` shell doesn't help by itself either:
# it's a fresh process that does NOT inherit the exports run.sh makes at
# runtime in PID 1, so seed.sh (api/seed.sh, shipped in the api image
# alongside run.sh/migrate.sh) re-exports the same six secret-backed vars
# itself before running the loaders. Idempotent - load_champions adds new
# champions, refreshes alias/image_url, and leaves everything else alone - so
# this is safe to run on every deploy. Requires an api image built with
# seed.sh present (api/api.Dockerfile COPYs it alongside run.sh).
# docker stack deploy is asynchronous, so poll for a running container
# instead of assuming one already exists.
.PHONY: seed-champions seed-champions-staging
seed-champions:
	@CID=""; \
	for i in $$(seq 1 30); do \
		CID=$$(docker ps -q -f name=mawster_api -f status=running | head -n1); \
		[ -n "$$CID" ] && break; \
		sleep 2; \
	done; \
	if [ -z "$$CID" ]; then \
		echo "seed-champions: no running mawster_api container found after 60s" >&2; \
		exit 1; \
	fi; \
	docker exec $$CID sh seed.sh

seed-champions-staging:
	@CID=""; \
	for i in $$(seq 1 30); do \
		CID=$$(docker ps -q -f name=mawster-staging_api -f status=running | head -n1); \
		[ -n "$$CID" ] && break; \
		sleep 2; \
	done; \
	if [ -z "$$CID" ]; then \
		echo "seed-champions-staging: no running mawster-staging_api container found after 60s" >&2; \
		exit 1; \
	fi; \
	docker exec $$CID sh seed.sh

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
	$(MAKE) seed-champions

panic:
	docker stack rm mawster
	docker stack rm mawster-obs
	docker stack rm mawster-staging

db-access:
	docker compose -f compose-prod.yaml -f compose-prod.yaml -f compose-db-access.yaml up mariadb backup -d

# Depends on vision-up so a single `make db-dev` brings up the full dev stack:
# rabbitmq + rustfs (+ rustfs-init to create the buckets) then mariadb + static.
db-dev: vision-up
	docker compose -f compose-dev.yaml up -d --build mariadb-dev static

db-dev-all:
	docker compose -f compose-dev.yaml up -d --build
