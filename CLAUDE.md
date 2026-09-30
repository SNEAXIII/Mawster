# CLAUDE.md

Mawster — MCOC (Marvel Contest of Champions) alliance management tool.

- **Backend** (`api/`): FastAPI + SQLModel + MariaDB (async), Python 3.14, **uv**
- **Frontend** (`front/`): Next.js App Router, React 19, Tailwind CSS 4, shadcn/ui
- **Auth**: Discord OAuth2 → NextAuth 5 → backend JWT (HS256), sent as `Authorization: Bearer`
- **i18n**: `useI18n()` — `front/app/i18n/locales/en.ts` & `fr.ts`

**Domain vocabulary lives in `CONTEXT.md`** — read it before naming or modelling anything.

---

## Scope Discipline

- Do exactly what was asked. No adjacent improvements (perf tweaks, extra refactors, unrequested
  test runs) unless requested — propose them in one line at the end instead.
- Announce what you're about to change before editing several files, then report what changed after.
- Before proposing an architecture, a framework or a data layer, explore the actual codebase and
  state the findings. Never recommend on assumptions the code would have invalidated.

---

## Commands

**Backend** (`api/`) — always via `make` (`make help`), never raw `pytest`/`alembic`/`uvicorn`.
Single test file: `uv run pytest tests/unit/dto/dto_from_model_test.py -v`

**Migrations** — **never hand-write one**: always the `/db-migrate` skill. Only edit the generated
file for review-level corrections.

**Frontend** (`front/`): `npm run dev`. The build runs in CI — check a change with
`npx oxlint --type-aware <files>`. Lint is oxlint alone: suppress with oxlint directives, convert any
`eslint-disable` you meet.

**Never run by hand what `.pre-commit-config.yaml` already runs** — ruff (check + format),
raises-arity, zizmor, oxlint, prettier, cypress `tsc`. The app `tsc` is not in there and still needs
a manual run.

**E2E** runs in CI: launch it only when asked. **Never** `npx cypress run` — the runner is
`scripts/e2e/e2e_parallel.py --spec "roster/foo.cy.ts"` (needs Docker, mariadb-test). Never pass
`--include-vision` from `/root/Mawster`: `fake-vision-worker` would consume the prod worker's queue.

**Servers**: `docker compose -f compose-dev.yaml up -d`, then `make run-dev` (`api/`) and
`npm run dev` (`front/`).

---

## Architecture

**Backend** (`api/src/`): thin `controllers/` delegate to `services/`; `models/` SQLModel tables;
`dto/` Pydantic schemas. async/await + `AsyncSession`; `selectinload()` for relationships (no lazy
loading); auth via `Depends(AuthService.get_current_user_in_jwt)`; raise `HTTPException` for errors.
`LoginLog.date_connexion` and `connexions` are accepted naming debt — leave them out of reviews.

**Frontend** (`front/app/`):

- `services/` — API wrappers; `lib/apiClient` auto-attaches the JWT
- `components/ui/` — shadcn/ui — **never modify directly**
- Page-scoped components in `_components/`, files ≤150 lines
- Reuse house components before a shadcn primitive — tabs are `@/components/tab-bar`, never shadcn `Tabs`
- `@radix-ui/react-slot` ≥1.3 ships no `"use client"`: a Server Component importing `Button` fails
  prerender with `createContext is not a function`. Add `'use client'` to that file.

---

## Testing

**Backend**: unit in `api/tests/unit/`, integration in `api/tests/integration/endpoints/` — on
in-memory SQLite, one per xdist worker, not MariaDB. Update tests alongside code changes.

**E2E** — setup helpers live in `front/cypress/support/e2e.ts`:

- `beforeEach(() => { cy.truncateDb(); })` in every `describe`
- `data-cy` + `cy.getByCy('...')` — never CSS classes or text; `ConfirmationDialog` confirm is
  `confirmation-dialog-confirm`
- `cy.apiLoadChampion(adminToken, name, class)` returns an array — chain `.then(champs => ...)`
- After fixes, re-run only the failing specs with `--spec`
- A list that reloads is asserted with `should(($els) => ...)` on `cy.get('[data-cy^="..."]')`:
  `.then()` runs once and a `getByCy` subject stays on detached nodes.
- Admin endpoints → the admin token, never the owner's.
- Specs named `*vision*` run nowhere. A bug only a vision spec would cover deserves a backend fix
  under pytest — say so before settling on a front-only fix.

---

## Key Conventions

- **Language**: English (code, comments, variables)
- **i18n**: `useI18n()` always — never hardcode strings; keys in both `en.ts` and `fr.ts`
- **Icons**: `lucide-react` general / `react-icons/fi` action buttons
- **Styling**: Tailwind semantic tokens (`bg-card`, `text-muted-foreground`), dark mode first
- **Explain changes**: after every Edit/Write, briefly say what changed and why
- **Ruff**: fix the sites first; an exception that must stay goes in `[lint.per-file-ignores]` or a
  `# noqa: RULE` on the line — the global `ignore` list is a last resort

### Comments — keep them rare

- **2 lines maximum.** No block above a config line, env var, workflow step or list entry.
- One rationale lives in **one** place. Never narrate the incident that motivated the code.
- Worth a comment: why something is *absent*, why a workaround exists, why an order is load-bearing.
- A decision a future reader would otherwise undo gets an ADR in `docs/adr/` — reserve it for the real ones.

### Commit types

release-please reads them for the version bump and `CHANGELOG.md`. **Pick the type by what a player
sees, never by which files you touched.**

| Type | Bump | Use for |
| --- | --- | --- |
| `feat:` | minor | something a player can now do |
| `fix:` | patch | something a player saw broken |
| `feat!:` / `BREAKING CHANGE:` | **major** | an irreversible migration, or data loss — nothing else |
| `ci:` `chore:` `build:` `refactor:` `test:` `docs:` `style:` | none, hidden | everything else |

**Never `feat(ci):` or `fix(docker):`** — a scope does not downgrade a type. Pipelines, Docker,
lockfiles, tooling, fixtures, E2E selectors and lint config are `ci:` or `chore:`. API signature
changes are not breaking: the front deploys in lockstep. Squash-merge PRs — a merge commit makes
release-please count every entry twice.

### Git safety

- Never `git commit --amend`, `git push --force`, `git reset --hard`, `git stash` on
  partially-staged work, or revert pushed commits without asking first.
- Before switching branches, warn about uncommitted changes rather than stashing them silently.
- On `main`, `release` or `staging`, branch before the first commit, whatever the size.
- `git push` belongs to the user: end on the exact command in a code block. `/git:make-pr`,
  `/git:commit push`, or an explicit go in reply to that command authorise you to push.
- Git skills — `/git:commit`, `/git:make-pr`, `/git:merge-pr` — come from the `git` plugin of the
  `sneaxiii-plugins` marketplace. Only `/release-pr` lives here.

### Worktrees

A fresh worktree has none of `node_modules` (root), `front/node_modules`, `api/.venv`,
`static-assets/.venv`, so lint, tsc and the front hooks fail. **Offer to link them from the main
checkout and wait for a yes** — never install per worktree, never link silently. On Windows use a
junction (`mklink /J <link> <target>`), same volume only.

A link **shares** the environment: read-only tooling is safe; anything that writes (`npm install`,
`uv sync`, `uv run` on a changed lockfile) corrupts the main checkout — warn first and install for
real instead.

### Verification before claiming

- Never state a fact about an external tool, API or CI behaviour from memory: read the file or
  search first, then cite the source.
- Never "correct" existing code or config without being able to point at the exact reason it is wrong.

---

## Context-Mode

- **Read** only right before an `Edit` — `ctx_execute_file` for everything else
- No Explore agents — `ctx_batch_execute` (`commands`/`queries` are JSON arrays, never strings)
- Bash only for git, mkdir, rm, mv and short commands — never grep/search/read
- No WebFetch / curl / wget — `ctx_fetch_and_index`
- Responses ≤500 words; write artifacts to files

GitHub goes through the `gh` CLI. No project MCP server — see `docs/mcp.md`. After any MCP server
change, tell the user to **restart Claude Code**.

Project agents in `.claude/agents/` are not auto-dispatched — consider routing a fitting task to one.

---

## Docker

**This checkout runs on the production swarm manager**: every `docker` command here and
`make deploy` act on the live `mawster` stack. Inspect freely; confirm with the user before anything
that mutates it (`stack deploy`, `service update`, `service rm`, secrets).

Dev ports and credentials: `compose-dev.yaml`.

### Backup / Restore

Backups are **gzipped** SQL dumps in `backups/` (`unzip` fails). The client is `mariadb`, never
`mysql` — the pinned 11.4 image ships no alias.

```bash
gunzip -c backups/<file>.sql.gz | docker exec -i mariadb-dev mariadb -u root -prootpassword mawster
```

A plain `.sql` goes through the container — PowerShell rejects `<`, and `Get-Content |` re-encodes
to cp1252 and corrupts the UTF-8:
```powershell
docker cp <file>.sql mariadb-dev:/tmp/dump.sql
docker exec mariadb-dev sh -c "mariadb -u root -prootpassword mawster < /tmp/dump.sql"
docker exec mariadb-dev rm /tmp/dump.sql
```

A restore overwrites the dev DB and lags the local head — run `make migrate` from `api/` afterwards.
