# CLAUDE.md

Mawster — MCOC (Marvel Contest of Champions) alliance management tool.

- **Backend**: FastAPI + SQLModel + MariaDB (async), Python 3.12, **uv**
- **Frontend**: Next.js App Router, React 19, Tailwind CSS 4, shadcn/ui
- **Auth**: Discord OAuth2 → NextAuth 5 → Backend JWT (HS256)
- **i18n**: `useI18n()` hook — `front/app/i18n/locales/en.ts` & `fr.ts`

---

## Commands

**Backend** (`api/`) — always via `make`, never raw `pytest`/`alembic`/`uvicorn`. Use skills: `make`, `db-reset`, `db-migrate`, `db-fixtures`, `db-champions`, `test-backend`.

Single test file: `uv run pytest tests/unit/dto/dto_from_model_test.py -v`
Lint: `uvx ruff check` (run at end of every backend session)

**Frontend** (`front/`): `npm run dev` / `npm run build` (run build to catch TS errors)

**E2E**: `mcp__cypress-runner__run_parallel` — source of truth. Pass `spec_files=["roster/foo.cy.ts"]` for targeted runs. Requires Docker (mariadb-test on port 3307).

**Servers**: use `/server-dev`, `/server-stop`, `/server-status` skills.

---

## Architecture

### Backend (`api/src/`)

- `controllers/` → thin routers, delegate to `services/`
- `services/` → business logic
- `models/` → SQLModel tables: User, Alliance, GameAccount, Champion, ChampionUser, DefensePlacement, AllianceOfficer, AllianceInvitation, RequestedUpgrade, LoginLog
- `dto/` → Pydantic request/response schemas
- `security/` → settings from `api.env`

**Patterns**: async/await + `AsyncSession`; `selectinload()` for relationships (no lazy loading); auth via `Depends(AuthService.get_current_user_in_jwt)`; raise `HTTPException` for errors.

**API routers:** `/admin`, `/auth`, `/users`, `/game-accounts`, `/alliances`, `/champion-users`, `/champions`, `/defense`

### Frontend (`front/app/`)

Pages: `game/roster/`, `game/defense/`, `game/alliances/`, `admin/`, `profile/`, `login/`, `register/`

- `services/` — API wrappers; `lib/apiClient` — auto-attaches JWT
- `components/ui/` — shadcn/ui (Radix) — **never modify directly**
- Pages use `_components/` for page-scoped components (keep files ≤150 lines)

Auth: NextAuth Discord OAuth2 → backend `POST /auth/discord` → JWT stored in session, attached as `Authorization: Bearer`.

DB: MariaDB (prod), SQLite in-memory (integration tests). Migrations via Alembic — always `make reset-db` before `make create-mig` / `make migrate`.

---

## Testing

**Backend**: unit in `api/tests/unit/`, integration in `api/tests/integration/endpoints/`. Always update tests alongside code changes.

**E2E conventions:**

- `beforeEach(() => { cy.truncateDb(); })` in every `describe`
- `data-cy` attributes + `cy.getByCy('...')` — never CSS classes or text
- `ConfirmationDialog` confirm: `data-cy='confirmation-dialog-confirm'`

**Setup helpers** (import from `'../../support/e2e'`):

| Helper | Returns |
| --- | --- |
| `setupUser(token)` | bare user, no game account |
| `setupAdmin(token)` | admin token |
| `setupAllianceOwner(prefix, pseudo, name, tag)` | user + game account + alliance |
| `setupWarOwner(prefix, pseudo, name, tag)` | `{ adminData, ownerData, allianceId, ownerAccId }` |
| `setupAttackerScenario(prefix)` | `{ adminToken, ownerData, memberData, allianceId, ownerAccId, memberAccId, warId, championUserId }` |
| `setupDefenseOwner(prefix, pseudo, name, tag)` | admin + owner + alliance + BG1 |
| `setupRosterUser(prefix, pseudo)` | admin + user + game account |

**Rules:**

- Admin endpoints → always `adminData.access_token` / `adminToken`, never `ownerData.access_token`
- Load champions: `cy.apiLoadChampion(adminToken, name, class)` → returns array, chain `.then(champs => ...)`
- Assign attacker: `cy.apiAssignWarAttacker(token, allianceId, warId, battlegroup, nodeNumber, championUserId)`
- After fixes: re-run only failing specs with `mcp__cypress-runner__run_parallel spec_files=[...]`

---

## Key Conventions

- **Language**: English (code, comments, variables)
- **Commits**: `feat:` `fix:` `refactor:` `test:` `docs:`
- **i18n**: `useI18n()` always — never hardcode strings; add keys to both `en.ts` and `fr.ts`
- **Icons**: `lucide-react` general / `react-icons/fi` action buttons
- **Styling**: Tailwind semantic tokens (`bg-card`, `text-muted-foreground`), dark mode first

---

## Context-Mode

Keep raw output out of context. Rules:

- **Read** only when about to `Edit` immediately after — use `ctx_execute_file` for everything else
- **No Explore agents** — use `ctx_batch_execute(commands, queries)` instead
- Bash only for: git, mkdir, rm, mv, short commands
- No WebFetch / curl / wget — use `ctx_fetch_and_index`
- Responses ≤500 words; write artifacts to files

Tools: `ctx_batch_execute` (research) → `ctx_search` (follow-up) → `ctx_execute`/`ctx_execute_file` (processing) → `ctx_fetch_and_index` + `ctx_search` (web)

---

## MCP Servers

> After any MCP server modification (new tool, param, schema): tell user to **restart Claude Code**.

- **context-mode**: keeps output out of context window
- **cypress-runner**: `mcp__cypress-runner__run_parallel`
- **pytest-runner**: `mcp__pytest-runner__run_all_tests` / `mcp__pytest-runner__run_failing_tests`
- **server-runner**: `start_dev` / `start_test` / `stop` / `status`
- **github**: `mcp__github__*` — requires `GITHUB_PERSONAL_ACCESS_TOKEN`

---

## Docker

- Dev: `docker compose -f compose-dev.yaml up -d` (MariaDB + phpMyAdmin 3306/8080)
- Prod: `docker compose -f compose-prod.yaml up -d` (Caddy TLS 80/443); Watchtower auto-deploys every 300s
