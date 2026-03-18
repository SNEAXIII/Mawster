# E2E Parallel Testing Design

**Date:** 2026-03-18
**Status:** Approved

## Overview

Run Cypress E2E tests in parallel using N isolated stacks (frontend + backend + MariaDB DB per worker), orchestrated by a Python script. Each worker is fully independent — no shared state, no DB conflicts.

Also: disable Cypress video recording globally, and generalize Next.js `distDir` to avoid lock conflicts between instances.

## Architecture

Each worker N (0 to N-1) gets an isolated stack:

| Component | Worker 0 | Worker 1 | Worker N |
|-----------|----------|----------|----------|
| Backend   | :8010    | :8011    | :8010+N  |
| Frontend  | :3010    | :3011    | :3010+N  |
| MariaDB   | `mawster_test_0` | `mawster_test_1` | `mawster_test_N` |

Ports 8010–8017 / 3010–3017 avoid conflicts with dev (8000/3000) and single test (8001/3001).

## Components

### 1. Disable Cypress videos

`front/cypress.config.ts`: set `video: false`.

### 2. Next.js distDir generalization

`front/next.config.ts` — replace hardcoded test-mode check with port-derived distDir:

```ts
// Before
const isTestMode = process.env.PORT === '3001';
distDir: isTestMode ? '.next-test' : '.next',

// After
const port = process.env.PORT ?? '3000';
distDir: port !== '3000' ? `.next-${port}` : '.next',
```

Result:
- PORT 3000 (dev) → `.next`
- PORT 3001 (single test) → `.next-3001`
- PORT 3010–3017 (parallel) → `.next-3010` … `.next-3017`

### 3. cypress-split

Install: `npm install --save-dev cypress-split` in `front/`.

Register in `cypress.config.ts`:
```ts
import cypressSplit from 'cypress-split';
// in setupNodeEvents:
setupNodeEvents(on, config) {
  cypressSplit(on, config);
  return config;
}
```

Each Cypress instance receives `--env split=N,splitIndex=I` and automatically runs its subset of specs.

### 4. Python orchestration script

**Location:** `scripts/e2e_parallel.py` (project root)

**Usage:**
```
python scripts/e2e_parallel.py --workers 4
```

**Flow:**
1. Parse `--workers N` (default: 2, max: 8)
2. Verify `mariadb-test` container is running via `docker exec`
3. For each worker N (in parallel via threads):
   - `docker exec mariadb-test mysql -uroot -prootpassword -e "CREATE DATABASE IF NOT EXISTS mawster_test_N;"`
   - `Popen` backend: `MODE=testing MARIADB_DATABASE=mawster_test_N PORT=8010+N uv run app_testing.py` (cwd: `api/`) — `app_testing.py` calls `reset()` which runs migrations automatically
   - `Popen` frontend: `PORT=3010+N API_PORT=8010+N NEXTAUTH_URL=http://localhost:3010+N npm run dev` (cwd: `front/`)
4. Health checks: poll `GET /health` on each backend, `GET /` on each frontend (timeout: 60s)
5. Launch N Cypress processes in parallel:
   ```
   npx cypress run
     --env backendUrl=http://localhost:8010+N,split=N,splitIndex=N
     --config baseUrl=http://localhost:3010+N
   ```
6. Wait for all Cypress processes to finish, collect exit codes
7. `atexit` handler: kill all backend and frontend processes
8. Exit with `max(exit_codes)` — non-zero if any Cypress worker failed

### 5. Makefile target

Root `Makefile`:
```makefile
e2e-parallel:
	python scripts/e2e_parallel.py --workers $(N)
```

Usage: `make e2e-parallel N=4`

## Environment Variables Summary

**Backend per worker N:**
```
MODE=testing
MARIADB_DATABASE=mawster_test_N
PORT=8010+N
```

**Frontend per worker N:**
```
PORT=3010+N
API_PORT=8010+N
NEXTAUTH_URL=http://localhost:3010+N
```

**Cypress per worker N:**
```
--env backendUrl=http://localhost:8010+N,split=<total>,splitIndex=N
--config baseUrl=http://localhost:3010+N
```

## CI/CD

Same command works in GitHub Actions:
```yaml
- run: make e2e-parallel N=4
```

Docker must be available for `mariadb-test` container.

## Out of Scope

- Teardown of MariaDB databases (no persistent volume, container restart clears them)
- Changes to Python/pytest test infrastructure (already optimal with SQLite per xdist worker)
- Cypress Cloud / paid orchestration services
