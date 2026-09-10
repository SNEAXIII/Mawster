# CLAUDE.md

Mawster — MCOC (Marvel Contest of Champions) alliance management tool.

- **Backend**: FastAPI + SQLModel + MariaDB (async), Python 3.14, **uv**
- **Frontend**: Next.js App Router, React 19, Tailwind CSS 4, shadcn/ui
- **Auth**: Discord OAuth2 → NextAuth 5 → Backend JWT (HS256)
- **i18n**: `useI18n()` hook — `front/app/i18n/locales/en.ts` & `fr.ts`

---

## Scope Discipline

- Do exactly what was asked. No adjacent improvements (perf tweaks, lazy-loading, extra refactors,
  unrequested test runs) unless explicitly requested — propose them in one line at the end instead.
- Announce what you're about to change before editing several files, then report what changed after.
- Before proposing an architecture, a framework choice, or an HTTP/data layer, first explore the
  actual codebase (`package.json`, existing modules, device/runtime constraints) and state the
  findings. Never give a recommendation resting on assumptions that exploring the code would
  have invalidated.

---

## Database Migrations

- **NEVER hand-write a migration.** Always generate it with the `/db-migrate` skill (Alembic
  autogenerate via the make targets). Only edit the generated file for review-level corrections.

---

## Commands

**Backend** (`api/`) — always via `/make` skill first, never raw `pytest`/`alembic`/`uvicorn`. Before any backend command, invoke `/make` to check available targets.

Single test file: `uv run pytest tests/unit/dto/dto_from_model_test.py -v`
Lint: `uvx ruff check` (run at end of every backend session)
Format: `uvx ruff format`

**Frontend** (`front/`): `npm run dev` / `npm run build` (run build to catch TS errors)

**E2E**: Always use the `/test-e2e` skill — **never** call `npx cypress run` directly. It wraps `scripts/e2e/e2e_parallel.py` (the CI runner); targeted runs via `--spec "roster/foo.cy.ts"`. Requires Docker (mariadb-test on port 3307).

**Migrations**: use `/db-migrate` skill — never touch dev DB directly.

**Servers**: use the `/server-dev` / `/server-stop` / `/server-status` skills (Docker compose + `make run-dev` + `npm run dev`).

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

## Custom agents (routing)

Project agents live in `.claude/agents/`. They are **not auto-dispatched** — consider routing to one via the Agent tool when a task fits. Hints, not mandates: skip trivial edits or when the user asks you to act directly.

| Task | Agent |
| --- | --- |
| Backend feature — endpoint / service / model / DTO (`api/`) | `backend-dev` |
| Review backend code | `backend-reviewer` |
| Frontend page / component (`front/`) | `frontend-dev` |
| Review frontend code | `frontend-reviewer` |
| Write backend tests | `test-python` |
| Auth / JWT / security changes | `security-reviewer` |

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
- After fixes: re-run only failing specs with `python3 scripts/e2e/e2e_parallel.py --spec "war/basic.cy.ts"`

---

## Key Conventions

- **Language**: English (code, comments, variables)
- **Commits**: see the commit types section below
- **i18n**: `useI18n()` always — never hardcode strings; add keys to both `en.ts` and `fr.ts`
- **Icons**: `lucide-react` general / `react-icons/fi` action buttons
- **Styling**: Tailwind semantic tokens (`bg-card`, `text-muted-foreground`), dark mode first
- **Explain changes**: After every Edit/Write, briefly explain what changed, why, and the expected effect

### Comments — keep them rare

Volume buries the one comment that matters, and most comments restate what the code
already says. Hard limits, not judgment calls:

- **2 lines maximum.**
- **No block above a config line, an env var, a workflow step or a list entry.** If the
  value needs justifying: one trailing line, or nothing.
- One rationale lives in **one** place — never the same explanation in two files.
- Never narrate the incident that motivated the code.
- Still worth a comment: why something is *absent*, why a workaround exists, why an order
  is load-bearing.
- A decision that genuinely matters — one a future reader would otherwise undo — gets an
  ADR in `docs/adr/`. Not a long comment, not a long commit body. Reserve it for the real
  ones; everything smaller needs no home at all.

### Commit types

release-please reads these to decide the version bump and to write `CHANGELOG.md`, so the type is
a decision, not a label. **Pick it by what a player sees, never by which files you touched.**

| Type | Bump | In the changelog | Use for |
| --- | --- | --- | --- |
| `feat:` | minor | yes | something a player can now do |
| `fix:` | patch | yes | something a player saw broken |
| `feat!:` / `BREAKING CHANGE:` | **major** | yes | see below |
| `ci:` `chore:` `build:` `refactor:` `test:` `docs:` `style:` | none | hidden | everything else |

**Never write `feat(ci):` or `fix(docker):`.** A scope does not downgrade a type: release-please
sections by type alone, so those land in the changelog and bump the version. Pipelines, Docker,
lockfiles, tooling, fixtures, E2E selectors and lint config are `ci:` or `chore:`, full stop.

Reserve the major bump for what actually breaks a user: an irreversible migration, or data loss.
Not API signature changes — the front deploys in lockstep with the API, so no external consumer
exists to break.

Prefer squash merge on pull requests. A merge commit carries the PR title into its body, which
release-please then counts a second time alongside the real commits, duplicating every entry.

### Git safety

- Never use `git commit --amend`, `git push --force`, `git reset --hard`, `git stash` on
  partially-staged work, or revert already-pushed commits without asking first.
- Before switching branches, check `git status` and warn about uncommitted changes rather than
  stashing them silently.

### Worktrees

A fresh worktree carries none of the four gitignored dependency directories, so `oxlint`,
`prettier`, `tsc` and the front pre-commit hooks fail there with `MODULE_NOT_FOUND` or exit 127.
**Offer to link them from the main checkout and wait for a yes** — never install per worktree,
never link silently:

| Directory | |
| --- | --- |
| `node_modules` (root) | `ln -s <main>/node_modules node_modules` |
| `front/node_modules` | idem |
| `api/.venv` | idem |
| `static-assets/.venv` | idem |

A link **shares** the environment, it does not copy it. Read-only tooling — lint, format,
typecheck, hooks, `npm run dev` — is safe. Anything that writes (`npm install`, `uv sync`, or
`uv run` against a lockfile the branch changed) reaches into the main checkout and corrupts it:
warn first, and install for real in the worktree instead.

On Windows outside WSL a symlink needs Developer Mode or an elevated shell; use a junction
(`mklink /J <link> <target>`), which needs neither. Same volume only, no network share.

### Verification before claiming

- Never state a fact about an external tool, API or CI behaviour from memory. Read the actual
  file/workflow or web-search first, then cite the source.
- Never "correct" existing code or config without having read it and being able to point at the
  exact reason it is wrong.

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

The project declares **no** MCP server of its own — there is no `.mcp.json`:

- **context-mode** (keeps output out of the context window) comes from the plugin enabled in
  `.claude/settings.json`. Its tools are prefixed `mcp__plugin_context-mode_context-mode__`.
  Never re-declare it in a `.mcp.json`: it would load a second copy of every tool.

GitHub operations (PRs, issues, reviews) go through the `gh` CLI. Backend tests, servers and E2E run as plain commands (`make`, `docker compose`, `scripts/e2e/e2e_parallel.py`) — see the Commands section above.

---

## Docker

- Dev: `docker compose -f compose-dev.yaml up -d`
  - `mariadb-dev` → host **3305** (container 3306), phpMyAdmin **8080**
  - `mariadb-test` → host **3307** (container 3306), phpMyAdmin **8081**
  - DB `mawster`, user `user`/`password`, root `rootpassword`
- Prod: Docker Swarm + Traefik (TLS 80/443), stack définie dans `stack-app.yaml`

### Backup / Restore

Backups are gzipped SQL dumps in `backups/` (e.g. `mawster_YYYY-MM-DD_HH-MM.sql.gz`) — **gzip, not zip** (`unzip` will fail).

The client is `mariadb`, never `mysql` — the pinned 11.4 image ships no `mysql*` alias.

Restore a dump into the dev DB (stream, no temp file):
```bash
gunzip -c backups/<file>.sql.gz | docker exec -i mariadb-dev mariadb -u root -prootpassword mawster
```

A plain `.sql` file goes through the container, never through a host redirection — PowerShell
rejects `<`, and `Get-Content |` re-encodes the stream to cp1252 and corrupts the UTF-8:
```powershell
docker cp <file>.sql mariadb-dev:/tmp/dump.sql
docker exec mariadb-dev sh -c "mariadb -u root -prootpassword mawster < /tmp/dump.sql"
docker exec mariadb-dev rm /tmp/dump.sql
```

A restore overwrites the dev DB, and the dump's `alembic_version` lags the local head — run
`make migrate` from `api/` afterwards.
