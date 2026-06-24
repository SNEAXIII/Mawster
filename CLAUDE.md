# CLAUDE.md

Mawster — MCOC (Marvel Contest of Champions) alliance management tool.

- **Backend**: FastAPI + SQLModel + MariaDB (async), Python 3.12, **uv**
- **Frontend**: Next.js App Router, React 19, Tailwind CSS 4, shadcn/ui
- **Auth**: Discord OAuth2 → NextAuth 5 → Backend JWT (HS256)
- **i18n**: `useI18n()` hook — `front/app/i18n/locales/en.ts` & `fr.ts`

---

## Commands

**Backend** (`api/`) — always via `/make` skill first, never raw `pytest`/`alembic`/`uvicorn`. Before any backend command, invoke `/make` to check available targets.

Single test file: `uv run pytest tests/unit/dto/dto_from_model_test.py -v`
Lint: `uvx ruff check` (run at end of every backend session)
Format: `uvx ruff format`

**Frontend** (`front/`): `npm run dev` / `npm run build` (run build to catch TS errors)

**E2E**: Always use the `/test-e2e` skill — **never** call `mcp__cypress-runner__run_parallel` directly. Pass `spec_files=["roster/foo.cy.ts"]` for targeted runs. Requires Docker (mariadb-test on port 3307).

**Migrations**: use `/db-migrate` skill — never touch dev DB directly.

**Servers**: use `mcp__server-runner__start_dev` / `mcp__server-runner__stop` / `mcp__server-runner__status`.

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

DB: MariaDB (prod), SQLite in-memory (integration tests). Migrations via Alembic — always `make reset-db` before `make create-mig` / `make migrate`. Migration message required: `make create-mig MESSAGE="your_migration_name"`.

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
- **Explain changes**: After every Edit/Write, briefly explain what changed, why, and the expected effect

---

## Context-Mode

Keep raw output out of context. Rules:

- **Read** only when about to `Edit` immediately after — use `ctx_execute_file` for everything else
- **No Explore agents** — use `ctx_batch_execute(commands, queries)` instead
- Bash only for: git, mkdir, rm, mv, short commands (**NEVER** for grep/search/read — use `Grep` tool or `ctx_batch_execute` instead)
- No WebFetch / curl / wget — use `ctx_fetch_and_index`
- Responses ≤500 words; write artifacts to files

Tools: `ctx_batch_execute` (research) → `ctx_search` (follow-up) → `ctx_execute`/`ctx_execute_file` (processing) → `ctx_fetch_and_index` + `ctx_search` (web)

**`ctx_batch_execute` usage — parameters must be JSON arrays, NOT strings:**
```json
{
  "commands": ["ls backup/", "cat backup/backup.sh"],
  "queries": ["backup system structure", "docker compose service"]
}
```

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

- Dev: `docker compose -f compose-dev.yaml up -d`
  - `mariadb-dev` → host **3305** (container 3306), phpMyAdmin **8080**
  - `mariadb-test` → host **3307** (container 3306), phpMyAdmin **8081**
  - DB `mawster`, user `user`/`password`, root `rootpassword`
- Prod: Docker Swarm + Traefik (TLS 80/443), stack définie dans `stack-app.yaml`

### Backup / Restore

Backups are gzipped SQL dumps in `backups/` (e.g. `mawster_YYYY-MM-DD_HH-MM.sql.gz`) — **gzip, not zip** (`unzip` will fail).

Restore a dump into the dev DB (stream, no temp file):
```bash
gunzip -c backups/<file>.sql.gz | mysql -h 127.0.0.1 -P 3305 -u root -prootpassword mawster
```

Or directly into the container:
```bash
gunzip -c backups/<file>.sql.gz | docker exec -i mariadb-dev mysql -u root -prootpassword mawster
```
