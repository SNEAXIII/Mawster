# MCP Servers

Mawster uses the MCP (Model Context Protocol) servers configured in `.mcp.json`. They extend Claude Code with project-specific tools so that Claude can start servers, run tests, manage the database, and interact with GitHub — without leaving the conversation.

---

## Overview

| Server | Source | Purpose |
|--------|--------|---------|
| `server-runner` | `mcp/server-runner/` | Start/stop dev & test servers |
| `pytest-runner` | `mcp/pytest-runner/` | Run backend unit/integration tests |
| `db-manager` | `mcp/db-manager/` | Reset DB, migrations, fixtures |
| `context-mode` | Plugin (Claude Code) | Keep output out of context window |
| `github` | `@modelcontextprotocol/server-github` | GitHub API (issues, PRs, files) |

---

## server-runner

Manages the dev and test stacks (MariaDB + FastAPI + Next.js). Each mode runs independently — starting dev does not affect the test stack and vice versa.

| Tool | Description |
|------|-------------|
| `start_dev` | MariaDB (3306) + API (8000) + Frontend (3000) |
| `start_test` | MariaDB-test (3307) + API (8001) + Frontend (3001) |
| `stop` | Stops all running servers (dev + test) |
| `status` | Returns running state of both stacks |
| `run_e2e` | Starts test stack if needed, then runs Cypress — all specs, or `spec_files` if given |

**Skills:** `/server-dev`, `/server-stop`, `/server-status`, `/test-e2e`

State is persisted in `.server-runner-state-dev.json` / `.server-runner-state-test.json` at repo root.

### E2E tests

`run_e2e` is the only E2E entry point. The former `cypress-runner` server was removed:
it ran specs in parallel across isolated workers, but served stale reports — a
"passing" result could reflect a previous run.

**Requires:** Docker with `mariadb-test` accessible on port 3307.

```
# All specs
mcp__server-runner__run_e2e

# Targeted run — paths relative to front/cypress/e2e/
mcp__server-runner__run_e2e spec_files=["war/operations.cy.ts", "roster/roster.cy.ts"]
```

Specs run sequentially, so a full suite is slow — prefer targeted runs locally and
let CI do the full pass. Results are written to `front/cypress/results/` (XML
reports, videos, screenshots); check their mtime to confirm a run actually produced them.

---

## pytest-runner

Runs FastAPI backend tests (unit + integration) using `uv run pytest` from `api/`.

| Tool | Key parameters | Description |
|------|----------------|-------------|
| `run_all_tests` | — | Delete previous results, run all tests |
| `run_failing_tests` | `paths` (array) | Re-run specific test files |
| `run_specific_tests` | `paths`, `keyword`, `verbose` | Run by path/ID and/or `-k` filter |

```
# All tests
mcp__pytest-runner__run_all_tests

# Specific file
mcp__pytest-runner__run_failing_tests paths=["tests/unit/dto/dto_from_model_test.py"]

# By keyword
mcp__pytest-runner__run_specific_tests keyword="test_end_war or test_create_war"
```

Results are written to `api/test-results/junit.xml`.

**Skill:** `/test-backend`, `/test-backend-failing`

---

## db-manager

Manages the database through the running API server. Requires a server to be started first (dev or test mode).

| Tool | Description |
|------|-------------|
| `truncate` | Truncate all tables via `POST /dev/truncate` |
| `load_champions` | Load/update champions from `scripts/champions.json` (idempotent) |
| `reset_db` | Drop all tables + `alembic upgrade head` (destructive) |
| `fixtures` | Load sample data (30 users, 1 alliance) |
| `setup` | Full setup: `reset_db` → `load_champions` → `fixtures` |
| `migrate` | Run pending Alembic migrations (`alembic upgrade head`) |

**Skills:** `/db-reset`, `/db-migrate`, `/db-fixtures`, `/db-champions`, `/db-setup`, `/db-truncate`

> `reset_db` is destructive — drops all tables. Always reset before creating or applying new migrations.

---

## context-mode

Plugin managed by Claude Code (not in `mcp/`). Keeps command output out of the context window to preserve space.

| Tool | Description |
|------|-------------|
| `ctx_batch_execute` | Run multiple commands + semantic queries at once |
| `ctx_execute` | Run a single command, result indexed |
| `ctx_execute_file` | Read + analyze a file without loading it into context |
| `ctx_search` | Semantic search over indexed content |
| `ctx_fetch_and_index` | Fetch a URL and index the content |
| `ctx_stats` | Show context usage stats |

**Convention (from CLAUDE.md):**
- Use `ctx_execute_file` to analyze files — only use `Read` immediately before `Edit`
- No Explore agents — use `ctx_batch_execute` instead
- No `WebFetch` — use `ctx_fetch_and_index`

---

## github

Standard `@modelcontextprotocol/server-github` package. Requires `GITHUB_PERSONAL_ACCESS_TOKEN` set as an environment variable.

Covers: issues, pull requests, branches, files, search, comments, reviews, merges.

```bash
# Set the token (add to your shell profile or .env)
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...
```

---

## Adding or modifying an MCP server

1. Edit `mcp/<server>/index.ts` (or create a new directory)
2. Rebuild: the servers run via `npx tsx` so no explicit build step is needed
3. Update `.mcp.json` if adding a new server
4. **Restart Claude Code** — MCP servers are loaded at startup; changes only take effect after a restart