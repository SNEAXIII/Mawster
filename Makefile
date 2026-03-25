# Root Makefile — E2E test orchestration
.PHONY: help e2e e2e-open e2e-parallel e2e-parallel-quiet e2e-db e2e-stop

NEXTAUTH_SECRET ?= e2e-local-nextauth-secret
NEXTAUTH_URL    ?= http://localhost:3000
SPEC            ?=

ifeq ($(OS),Windows_NT)
# ── Windows (PowerShell) ─────────────────────────────────────────────────────
SHELL := powershell.exe
.SHELLFLAGS := -NoProfile -Command

help:
	@Write-Host "e2e          --> demarrer les services + lancer Cypress headless"
	@Write-Host "e2e-open     --> demarrer les services + ouvrir l'UI Cypress"
	@Write-Host "e2e-parallel --> lancer les tests E2E en parallèle (N=4 par défaut, max 8)"
	@Write-Host "e2e-parallel-quiet --> lancer les tests E2E en parallèle en mode silencieux (N=4 par défaut, max 8)"
	@Write-Host "e2e-db       --> demarrer uniquement mariadb-test"
	@Write-Host "e2e-stop     --> arreter l'API et le frontend de test"
	@Write-Host "Logs : .e2e-api.log  .e2e-front.log"
	@Write-Host "Variables : N=4  SPEC=war/war-management.cy.ts  Q=1  NEXTAUTH_SECRET=..."

e2e-stop:
	if (Test-Path .e2e-api.pid) { Stop-Process -Id (Get-Content .e2e-api.pid) -Force -ErrorAction SilentlyContinue; Remove-Item .e2e-api.pid -Force -ErrorAction SilentlyContinue }
	if (Test-Path .e2e-front.pid) { Stop-Process -Id (Get-Content .e2e-front.pid) -Force -ErrorAction SilentlyContinue; Remove-Item .e2e-front.pid -Force -ErrorAction SilentlyContinue }

e2e: e2e-db
	$$env:MODE = 'testing'; (Start-Process -PassThru -NoNewWindow -FilePath cmd -ArgumentList '/c uv run app_testing.py' -WorkingDirectory api -RedirectStandardOutput ../.e2e-api.log -RedirectStandardError ../.e2e-api.log).Id | Out-File -Encoding ascii .e2e-api.pid
	$$env:NEXTAUTH_SECRET = '$(NEXTAUTH_SECRET)'; $$env:NEXTAUTH_URL = '$(NEXTAUTH_URL)'; (Start-Process -PassThru -NoNewWindow -FilePath cmd -ArgumentList '/c npm run testing' -WorkingDirectory front -RedirectStandardOutput ../.e2e-front.log -RedirectStandardError ../.e2e-front.log).Id | Out-File -Encoding ascii .e2e-front.pid
	@Write-Host 'Attente de l API (port 8001)...'; for ($$i = 0; $$i -lt 30; $$i++) { if ((Test-NetConnection -ComputerName localhost -Port 8001 -WarningAction SilentlyContinue).TcpTestSucceeded) { break }; Start-Sleep 2 }
	@Write-Host 'Attente du frontend (port 3001)...'; for ($$i = 0; $$i -lt 60; $$i++) { if ((Test-NetConnection -ComputerName localhost -Port 3001 -WarningAction SilentlyContinue).TcpTestSucceeded) { break }; Start-Sleep 2 }
	@Write-Host 'Lancement de Cypress...'; Set-Location front; npx cypress run $(if $(SPEC),--spec $(SPEC),); $$EXIT = $$LASTEXITCODE; Set-Location ..; if (Test-Path .e2e-api.pid) { Stop-Process -Id (Get-Content .e2e-api.pid) -Force -EA SilentlyContinue; Remove-Item .e2e-api.pid -Force -EA SilentlyContinue }; if (Test-Path .e2e-front.pid) { Stop-Process -Id (Get-Content .e2e-front.pid) -Force -EA SilentlyContinue; Remove-Item .e2e-front.pid -Force -EA SilentlyContinue }; exit $$EXIT

e2e-open: e2e-db
	$$env:MODE = 'testing'; (Start-Process -PassThru -NoNewWindow -FilePath cmd -ArgumentList '/c uv run app_testing.py' -WorkingDirectory api -RedirectStandardOutput ../.e2e-api.log -RedirectStandardError ../.e2e-api.log).Id | Out-File -Encoding ascii .e2e-api.pid
	$$env:NEXTAUTH_SECRET = '$(NEXTAUTH_SECRET)'; $$env:NEXTAUTH_URL = '$(NEXTAUTH_URL)'; (Start-Process -PassThru -NoNewWindow -FilePath cmd -ArgumentList '/c npm run testing' -WorkingDirectory front -RedirectStandardOutput ../.e2e-front.log -RedirectStandardError ../.e2e-front.log).Id | Out-File -Encoding ascii .e2e-front.pid
	@Write-Host 'Attente de l API (port 8001)...'; for ($$i = 0; $$i -lt 30; $$i++) { if ((Test-NetConnection -ComputerName localhost -Port 8001 -WarningAction SilentlyContinue).TcpTestSucceeded) { break }; Start-Sleep 2 }
	@Write-Host 'Attente du frontend (port 3001)...'; for ($$i = 0; $$i -lt 60; $$i++) { if ((Test-NetConnection -ComputerName localhost -Port 3001 -WarningAction SilentlyContinue).TcpTestSucceeded) { break }; Start-Sleep 2 }
	@Write-Host 'Lancement de Cypress...'; Set-Location front; npx cypress open

e2e-parallel: e2e-db
	python scripts/e2e_parallel.py --workers $(if $(N),$(N),4) $(if $(SPEC),--spec $(SPEC),) $(if $(Q),--quiet,)

e2e-parallel-quiet: e2e-db
	python scripts/e2e_parallel.py --workers $(if $(N),$(N),4) $(if $(SPEC),--spec $(SPEC),) --quiet

else
# ── Linux / macOS ─────────────────────────────────────────────────────────────

help:
	@echo "e2e          --> demarrer les services + lancer Cypress headless"
	@echo "e2e-open     --> demarrer les services + ouvrir l'UI Cypress"
	@echo "e2e-parallel --> lancer les tests E2E en parallèle (N=4 par défaut, max 8)"
	@echo "e2e-parallel-quiet --> lancer les tests E2E en parallèle en mode silencieux (N=4 par défaut, max 8)"
	@echo "e2e-db       --> demarrer uniquement mariadb-test"
	@echo "e2e-stop     --> arreter l'API et le frontend de test"
	@echo "Variables : N=4  SPEC=war/war-management.cy.ts  Q=1  NEXTAUTH_SECRET=..."

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

endif

e2e-db:
	docker compose -f compose-dev.yaml up mariadb-test -d