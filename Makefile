# Root Makefile — E2E test orchestration + backup operations
.PHONY: help e2e e2e-open e2e-parallel e2e-parallel-quiet e2e-db e2e-stop \
        backup-deploy backup-now backup-list backup-logs backup-restore backup-restore-remote deploy db

NEXTAUTH_SECRET ?= e2e-local-nextauth-secret
NEXTAUTH_URL    ?= http://localhost:3000
SPEC            ?=

ifeq ($(OS),Windows_NT)
# ── Windows (PowerShell) ─────────────────────────────────────────────────────
SHELL := powershell.exe
.SHELLFLAGS := -NoProfile -Command

help:
	@echo ""
	@echo "deploy                --> builder les images et (re)demarrer tous les containers de production"
	@echo "db-dev                --> demarrer les services de base de donnees en mode developpement"
	@echo "=== E2E ==="
	@echo "e2e                  --> demarrer les services + lancer Cypress headless"
	@echo "e2e-open             --> demarrer les services + ouvrir l'UI Cypress"
	@echo "e2e-parallel         --> lancer les tests E2E en parallèle (N=4 par défaut, max 8)"
	@echo "e2e-parallel-quiet   --> lancer les tests E2E en parallèle en mode silencieux"
	@echo "e2e-db               --> demarrer uniquement mariadb-test"
	@echo "e2e-stop             --> arreter l'API et le frontend de test"
	@echo "Logs      : .e2e-api.log  .e2e-front.log"
	@echo "Variables : N=4  SPEC=war/war-management.cy.ts  Q=1  NEXTAUTH_SECRET=..."
	@echo ""
	@echo "=== Backup ==="
	@echo "backup-deploy        --> builder l'image et (re)demarrer le container backup"
	@echo "backup-now           --> declencher un backup immediatement"
	@echo "backup-list          --> lister les fichiers de backup locaux"
	@echo "backup-logs          --> afficher les logs du container backup"
	@echo "backup-restore       --> restaurer depuis un backup local (FILE=mawster_YYYY-MM-DD_HH-MM.sql.gz)"
	@echo "backup-restore-remote --> restaurer depuis Google Drive (FILE=mawster_YYYY-MM-DD_HH-MM.sql.gz)"
	@echo ""

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

else
# ── Linux / macOS ─────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "deploy                --> builder les images et (re)demarrer tous les containers de production"
	@echo "db-dev                --> demarrer les services de base de donnees en mode"
	@echo "=== E2E ==="
	@echo "e2e                   --> demarrer les services + lancer Cypress headless"
	@echo "e2e-open              --> demarrer les services + ouvrir l'UI Cypress"
	@echo "e2e-parallel          --> lancer les tests E2E en parallèle (N=4 par défaut, max 8)"
	@echo "e2e-parallel-quiet    --> lancer les tests E2E en parallèle en mode silencieux"
	@echo "e2e-db                --> demarrer uniquement mariadb-test"
	@echo "e2e-stop              --> arreter l'API et le frontend de test"
	@echo "Logs      : .e2e-api.log  .e2e-front.log"
	@echo "Variables : N=4  SPEC=war/war-management.cy.ts  Q=1  NEXTAUTH_SECRET=..."
	@echo ""
	@echo "=== Backup ==="
	@echo "backup-deploy         --> builder l'image et (re)demarrer le container backup"
	@echo "backup-now            --> declencher un backup immediatement"
	@echo "backup-list           --> lister les fichiers de backup locaux"
	@echo "backup-logs           --> afficher les logs du container backup"
	@echo "backup-restore        --> restaurer depuis un backup local (FILE=mawster_YYYY-MM-DD_HH-MM.sql.gz)"
	@echo "backup-restore-remote --> restaurer depuis Google Drive (FILE=mawster_YYYY-MM-DD_HH-MM.sql.gz)"
	@echo ""

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

backup-restore:
	@test -n "$(FILE)" || (echo "Usage: make backup-restore FILE=mawster_YYYY-MM-DD_HH-MM.sql.gz" && exit 1)
	docker exec -e MARIADB_ROOT_PASSWORD="$$(grep MARIADB_ROOT_PASSWORD db.env | cut -d= -f2)" \
		backup /usr/local/bin/restore.sh $(FILE)

backup-restore-remote:
	@test -n "$(FILE)" || (echo "Usage: make backup-restore-remote FILE=mawster_YYYY-MM-DD_HH-MM.sql.gz" && exit 1)
	docker exec -e MARIADB_ROOT_PASSWORD="$$(grep MARIADB_ROOT_PASSWORD db.env | cut -d= -f2)" \
		backup /usr/local/bin/restore.sh --remote $(FILE)

endif

e2e-db:
	docker compose -f compose-dev.yaml up mariadb-test -d

# ── Backup ────────────────────────────────────────────────────────────────────

## Build the backup image and (re)start the backup container
backup-deploy:
	docker compose -f compose-prod.yaml up -d --build backup

## Trigger a backup immediately (runs backup.sh inside the swarm container)
backup-now:
	docker exec $$(docker ps -q -f name=mawster_backup) /usr/local/bin/backup.sh

## Tail the backup container logs
backup-logs:
	docker compose -f compose-prod.yaml logs -f backup

deploy:
	docker pull sneaxiii/mawster-api:latest
	docker pull sneaxiii/mawster-front:latest
	docker pull sneaxiii/mawster-backup:latest
	docker stack deploy --with-registry-auth --resolve-image always -c stack-obs.yaml mawster-obs
	docker stack deploy --with-registry-auth --resolve-image always -c stack-app.yaml mawster

panic:
	docker stack rm mawster
	docker stack rm mawster-obs

db-access:
	docker compose -f compose-prod.yaml -f compose-prod.yaml -f compose-db-access.yaml up mariadb backup -d

db-dev:
	docker compose -f compose-dev.yaml up -d