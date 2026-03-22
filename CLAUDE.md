# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mawster is a MCOC (Marvel Contest of Champions) alliance management tool.

- **Backend**: FastAPI + SQLModel + MariaDB (async), Python 3.12, managed with **uv**
- **Frontend**: Next.js (App Router, Turbopack), React 19, Tailwind CSS 4, shadcn/ui
- **Auth**: Discord OAuth2 → NextAuth 5 → Backend JWT (HS256)
- **i18n**: Custom hook `useI18n()` with EN/FR locale files in `front/app/i18n/locales/`

---

## Backend Commands (`api/`)

Always run from the `api/` directory via `make`. **Never** run raw `pytest`, `alembic`, or `uvicorn` directly.

| Task                 | Command                                           |
| -------------------- | ------------------------------------------------- |
| Run dev server       | `make run-dev`                                    |
| Install deps (dev)   | `make install-dev`                                |
| Create migration     | `make reset-db` then `make create-mig MIGRATION_MESSAGE="description"` |
| Apply migrations     | `make reset-db` then `make migrate`                                    |
| Run all tests        | `make test`                                       |
| Run tests + coverage | `make test-cov`                                   |
| Load fixtures        | `make fixtures`                                   |
| Load champions       | `make load-champions`                             |
| Reset database       | `make reset-db`                                   |
| Lint                 | `uvx ruff check`                                  |

To run a single test file: `uv run pytest tests/unit/dto/dto_from_model_test.py -v`

## Frontend Commands (`front/`)

| Task                      | Command                |
| ------------------------- | ---------------------- |
| Run dev server            | `npm run dev`          |
| Build                     | `npm run build`        |
| Run Cypress (interactive) | `npm run cypress:open` |
| Run Cypress (headless)    | `npm run cypress:run`  |

## E2E Commands (root Makefile)

**IMPORTANT** : `mcp__server-runner__run_e2e` bascule automatiquement en mode test si nécessaire — ne jamais appeler `start_test` avant `run_e2e`, ça causerait un double redémarrage des serveurs et doublerait le temps d'attente.

Ces commandes démarrent automatiquement l'API de test, le frontend, et Cypress.

| Task                              | Command                                   |
| --------------------------------- | ----------------------------------------- |
| Lancer tous les tests E2E         | `make e2e`                                |
| Ouvrir Cypress en mode interactif | `make e2e-open`                           |
| Un seul spec                      | `SPEC=cypress/e2e/account.cy.ts make e2e` |
| Démarrer seulement la DB de test  | `make e2e-db`                             |
| Arrêter API + frontend de test    | `make e2e-stop`                           |

**Prérequis** : Docker en cours d'exécution (pour `mariadb-test` sur le port 3307).

---

## Architecture

### Backend (`api/src/`)

- **`controllers/`** — APIRouter modules; thin, delegate to services
- **`services/`** — Stateless service classes with business logic
- **`models/`** — SQLModel table classes (User, Alliance, GameAccount, Champion, ChampionUser, DefensePlacement, AllianceOfficer, AllianceInvitation, RequestedUpgrade, LoginLog)
- **`dto/`** — Pydantic `BaseModel` schemas for request/response
- **`security/`** — Settings loaded from `api.env`
- **`utils/db.py`** — Async engine and session factory

**Patterns:**

- All DB operations are `async`/`await` with `AsyncSession`
- Relationships must use `selectinload()` — no lazy loading in async SQLModel
- Auth via `Depends(AuthService.get_current_user_in_jwt)` in controllers
- Raise `HTTPException` with proper status codes for errors

**API routers:** `/admin`, `/auth`, `/users`, `/game-accounts`, `/alliances`, `/champion-users`, `/champions`, `/defense`

### Frontend (`front/`)

- **`app/`** — Next.js App Router pages (`game/roster/`, `game/defense/`, `game/alliances/`, `admin/`, `profile/`, `login/`, `register/`)
- **`app/services/`** — API call wrappers (e.g., `roster.ts`, `defense.ts`, `game.ts`)
- **`app/lib/apiClient`** — Axios/fetch client that auto-attaches JWT from NextAuth session
- **`app/i18n/`** — `useI18n()` hook + `locales/en.ts` & `locales/fr.ts`
- **`components/ui/`** — shadcn/ui primitives (Radix-based); **never modify directly**
- **`components/`** — App-specific shared components
- **`hooks/`** — Custom React hooks

Pages use `_components/` subdirectories for page-scoped components.

### Auth Flow

1. User clicks "Login with Discord" → NextAuth Discord OAuth2
2. NextAuth POSTs Discord `access_token` to `POST /auth/discord` (backend)
3. Backend verifies token with Discord API, creates/finds user, returns JWT
4. JWT stored in NextAuth session; `apiClient` attaches it as `Authorization: Bearer`

### Database

MariaDB in production, SQLite in-memory for integration tests. Migrations managed by Alembic via `make create-mig` / `make migrate`.

---

## Testing

**Backend:**

- Unit tests: `api/tests/unit/` (no DB)
- Integration tests: `api/tests/integration/endpoints/` (SQLite in-memory, `httpx.AsyncClient`)
- Setup factories: `tests/integration/endpoints/setup/`
- Helpers: `tests/utils/`
- Always update tests alongside code changes

**Frontend (Cypress E2E):**

- Tests in `front/cypress/e2e/` (organized by feature: `alliances/`, `defense/`, `war/`, `roster/`, etc.)
- Base URL: `http://localhost:3000`
- Support file: `front/cypress/support/e2e.ts` — all custom commands and setup helpers live here
- Type declarations: `front/cypress/support/index.d.ts` — update when adding a new `Cypress.Commands.add`

**E2E conventions:**

- Every `describe` block starts with `beforeEach(() => { cy.truncateDb(); })` — never share DB state between tests
- Use `data-cy` attributes for all selectors; query them with `cy.getByCy('...')` — never use CSS classes or text for selection
- Add `data-cy` to any new interactive element that tests need to reach
- `ConfirmationDialog` confirm button exposes `data-cy='confirmation-dialog-confirm'`

**Setup helpers** (defined in `e2e.ts`, import from `'../../support/e2e'`):

| Helper | Use when |
| --- | --- |
| `setupUser(token)` | Need a bare user with no game account |
| `setupAdmin(token)` | Need an admin token (e.g. to call `/admin/*` endpoints) |
| `setupAllianceOwner(prefix, pseudo, name, tag)` | Need a user with game account + alliance |
| `setupWarOwner(prefix, pseudo, name, tag)` | Need admin + owner + alliance for war tests — returns `{ adminData, ownerData, allianceId, ownerAccId }` |
| `setupDefenseOwner(prefix, pseudo, name, tag)` | Need admin + owner + alliance + BG1 for defense tests |
| `setupRosterUser(prefix, pseudo)` | Need admin + user + game account for roster tests |

**Rules for setup helpers:**

- Admin endpoints (`/admin/*`) require an admin token — always use `adminData.access_token`, never `ownerData.access_token`
- Use `cy.apiLoadChampion(adminToken, name, class)` to load a champion; it returns the champion array so you can chain `.then(champs => ...)` to get the ID
- Never write raw `cy.request({ method: 'POST', url: '.../admin/champions/load', ... })` in tests — use `cy.apiLoadChampion` instead
- After loading a champion and needing its ID, chain directly: `cy.apiLoadChampion(...).then(champs => cy.apiPlaceWarDefender(..., champs[0].id, ...))`

**After fixing failing tests — re-run only those specs:**

```
# E2E
mcp__cypress-runner__run_failing_tests  (or skill: test-cypress-failing)

# Backend
mcp__pytest-runner__run_failing_tests   (or skill: test-backend-failing)
```

Only use `run_e2e` / `run_all_tests` after structural changes that could affect unrelated tests.

---

## Key Conventions

- **Language**: all code, comments, and variable names in **English**
- **Commits**: conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)
- **i18n**: always `const { t } = useI18n()` — never hardcode user-visible strings; add keys to both `en.ts` and `fr.ts`
- **Icons**: `lucide-react` for general icons, `react-icons/fi` (Feather) for action buttons
- **Styling**: Tailwind with semantic tokens (`bg-card`, `text-muted-foreground`), dark mode first
- **Components**: keep ≤150 lines; split into `_components/` subdirectory if larger
- **Lint**: run `uvx ruff check` at end of every backend session; `npm run build` to catch frontend TS errors

---

## Docker

- Dev DB only: `docker compose -f compose-dev.yaml up -d` (starts MariaDB + phpMyAdmin on ports 3306/8080)
- Production: `docker compose -f compose-prod.yaml up -d` (Caddy TLS reverse proxy on 80/443)
- Images: `sneaxiii/mawster-api` and `sneaxiii/mawster-front`; Watchtower auto-deploys every 300s

---

## Context-Mode

Raw tool output floods the context window. Use context-mode MCP tools to keep raw data in the sandbox.

### Tool Selection

1. **GATHER**: `batch_execute(commands, queries)` — Primary tool for research. Runs all commands, auto-indexes, and searches. ONE call replaces many individual steps.
2. **FOLLOW-UP**: `search(queries: ["q1", "q2", ...])` — Use for all follow-up questions. ONE call, many queries.
3. **PROCESSING**: `execute(language, code)` or `execute_file(path, language, code)` — Use for API calls, log analysis, and data processing.
4. **WEB**: `fetch_and_index(url)` then `search(queries)` — Fetch, index, then query. Never dump raw HTML.

### Rules

- DO NOT use Bash for commands producing >20 lines of output — use `execute` or `batch_execute`.
- **CRITICAL — Read vs ctx_execute_file**: Use `Read` ONLY when you are about to `Edit` the file immediately after. For ANY other file reading (exploration, analysis, debugging, searching for bugs) use `ctx_execute_file` instead. Violating this rule floods the context window.
- **CRITICAL — No Explore agents**: NEVER launch Explore subagents for codebase research. Use `batch_execute(commands, queries)` instead — it keeps output out of context and costs far fewer tokens.
- DO NOT use WebFetch — use `fetch_and_index` instead.
- DO NOT use curl/wget in Bash — use `execute` or `fetch_and_index`.
- Bash is ONLY for git, mkdir, rm, mv, navigation, and short commands.

### Output

- Keep responses under 500 words.
- Write artifacts (code, configs) to FILES — never return them as inline text.
- Return only: file path + 1-line description.

---

## MCP Servers

> **⚠️ IMPORTANT — après toute modification d'un serveur MCP** (nouveau tool, nouveau paramètre, changement de schéma) : prévenir l'utilisateur qu'il doit **redémarrer Claude Code** pour que le nouveau schéma soit pris en compte. Sans redémarrage, les anciens paramètres (ou l'absence de paramètres) restent actifs et les appels se font avec le mauvais schéma.

Four MCP servers are configured in `.mcp.json`:

### context-mode

Keeps raw command/file output out of the context window (see [Context-Mode](#context-mode) section above).

### cypress-runner

Runs Cypress E2E tests from the assistant. Prefer this over `npm run cypress:run` via Bash.

| Tool                                        | Description                        |
| ------------------------------------------- | ---------------------------------- |
| `mcp__cypress-runner__run_all_tests`        | Run the full Cypress E2E suite     |
| `mcp__cypress-runner__run_failing_tests`    | Re-run only previously failed tests |

### pytest-runner

Runs backend pytest tests from the assistant. Prefer this over `make test` via Bash when output is large.

| Tool                                       | Description                        |
| ------------------------------------------ | ---------------------------------- |
| `mcp__pytest-runner__run_all_tests`        | Run the full pytest suite          |
| `mcp__pytest-runner__run_failing_tests`    | Re-run only previously failed tests |

### server-runner

Gère le cycle de vie des serveurs dev et test depuis l'assistant. Démarre/arrête API + Frontend + DB en un seul appel.

| Outil MCP | Description |
| --- | --- |
| `mcp__server-runner__start_dev` | Lance mariadb (3306) + API (8000) + Frontend (3000) en mode dev |
| `mcp__server-runner__start_test` | Lance mariadb-test (3307) + API (8001) + Frontend (3001) en mode test |
| `mcp__server-runner__stop` | Arrête tous les serveurs démarrés |
| `mcp__server-runner__status` | Mode actif, PIDs, ports, uptime |
| `mcp__server-runner__run_e2e` | Démarre le mode test si besoin, lance Cypress, retourne les résultats |

### github

Interact with GitHub (issues, PRs, branches, files) without leaving the assistant.

- Use `mcp__github__*` tools for all GitHub operations (create PR, merge, comment, etc.)
- `GITHUB_PERSONAL_ACCESS_TOKEN` must be set in the environment.
