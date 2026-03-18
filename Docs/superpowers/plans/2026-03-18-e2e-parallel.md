# E2E Parallel Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run Cypress E2E tests in parallel across N isolated stacks (frontend + backend + MariaDB DB per worker), orchestrated by a Python script, with videos disabled and no Next.js lock conflicts.

**Architecture:** Each worker N gets its own backend (port 8010+N), frontend (port 3010+N), and MariaDB database (`mawster_test_N`). A Python script creates DBs via `docker exec`, starts all servers, waits for health checks, then launches N Cypress instances in parallel using `cypress-split` for spec distribution.

**Tech Stack:** Python 3.12, cypress-split (npm), Next.js PORT-based distDir, docker exec for DB creation, pytest-xdist (unchanged)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `front/cypress.config.ts` | Modify | Disable video, register cypress-split plugin |
| `front/next.config.ts` | Modify | Generalize distDir to `.next-{PORT}` for any non-3000 port |
| `front/package.json` | Modify | Add `cypress-split` dev dependency (via npm install) |
| `scripts/e2e_parallel.py` | Create | Python orchestration: DB creation, server startup, Cypress launch |
| `Makefile` (root) | Modify | Add `e2e-parallel` target |
| `front/.gitignore` | Modify | Ignore `.next-30*` build artifact directories |

---

## Task 1: Disable Cypress video recording

**Files:**
- Modify: `front/cypress.config.ts`

- [ ] **Step 1: Update cypress.config.ts**

Change `video: true` to `video: false`:

```ts
// front/cypress.config.ts
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3001',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    setupNodeEvents() {},
  },
  video: false,
  screenshotsFolder: 'cypress/results/screenshots',
  reporter: 'cypress-multi-reporters',
  reporterOptions: {
    configFile: 'cypress/reporter-config.json',
  },
});
```

Note: remove `videosFolder` line too since video is disabled.

- [ ] **Step 2: Commit**

```bash
git add front/cypress.config.ts
git commit -m "chore: disable cypress video recording"
```

---

## Task 2: Generalize Next.js distDir

**Files:**
- Modify: `front/next.config.ts`

**Context:** Currently `distDir` is hardcoded to `.next-test` only when `PORT === '3001'`. Workers on ports 3010–3017 would share the default `.next` dir and conflict. Fix: derive distDir from PORT for any non-dev port.

- [ ] **Step 1: Update distDir logic in next.config.ts**

Replace the `isTestMode` block:

```ts
// Before
const isTestMode = process.env.PORT === '3001';
// ...in nextConfig:
distDir: isTestMode ? '.next-test' : '.next',

// After
const port = process.env.PORT ?? '3000';
// ...in nextConfig:
distDir: port !== '3000' ? `.next-${port}` : '.next',
```

Full updated next.config.ts for reference:
```ts
import type { NextConfig } from 'next';
const API_SERVER_HOST = process.env.NODE_ENV === 'production' ? 'api' : 'localhost';
const API_PORT = process.env.API_PORT ?? '8000';
const NEXT_PUBLIC_API_CLIENT_HOST = process.env.NEXT_PUBLIC_API_CLIENT_HOST ?? 'localhost';
const API_CLIENT_END_PART = process.env.NODE_ENV === 'production' ? '/api/back' : `:${API_PORT}`;
const port = process.env.PORT ?? '3000';

const nextConfig: NextConfig = {
  output: 'standalone',
  distDir: port !== '3000' ? `.next-${port}` : '.next',
  async rewrites() {
    return [
      {
        source: '/static/:path*',
        destination: `${SERVER_API_URL}/static/:path*`,
      },
    ];
  },
};
export const CLIENT_API_URL: string = `http://${NEXT_PUBLIC_API_CLIENT_HOST}${API_CLIENT_END_PART}`;
export const SERVER_API_URL: string = `http://${API_SERVER_HOST}:${API_PORT}`;
export default nextConfig;
```

- [ ] **Step 2: Add .next-30* to front/.gitignore**

Add these lines to `front/.gitignore` (parallel worker build dirs should not be committed):
```
.next-30*/
```

Also verify no existing `.next-test` reference remains:
```bash
grep -r "next-test" front/ --include="*.ts" --include="*.json" --include="*.md"
```
Expected: no results (the old `.next-test` dir name is gone, replaced by `.next-3001`).

- [ ] **Step 3: Verify single test mode still works**

Start the test server normally and confirm `front/.next-3001/` is created (not `.next-test/`). This requires the test stack to be running:
```bash
mcp__server-runner__start_test
```
Then check the directory: `ls front/.next-3001/` should exist.

If `.next-3001` directory is created → correct.

- [ ] **Step 4: Commit**

```bash
git add front/next.config.ts front/.gitignore
git commit -m "chore: generalize next.js distDir to .next-{PORT} for parallel workers"
```

---

## Task 3: Install cypress-split and register plugin

**Files:**
- Modify: `front/package.json` (via npm install)
- Modify: `front/cypress.config.ts`

**Context:** `cypress-split` reads `split` and `splitIndex` from Cypress env vars and filters the spec list automatically. Each Cypress instance receives `--env split=N,splitIndex=I`.

- [ ] **Step 1: Install cypress-split**

```bash
cd front
npm install --save-dev cypress-split
```

- [ ] **Step 2: Register the plugin in cypress.config.ts**

```ts
import { defineConfig } from 'cypress';
import cypressSplit from 'cypress-split';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3001',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    setupNodeEvents(on, config) {
      cypressSplit(on, config);
      return config;
    },
  },
  video: false,
  screenshotsFolder: 'cypress/results/screenshots',
  reporter: 'cypress-multi-reporters',
  reporterOptions: {
    configFile: 'cypress/reporter-config.json',
  },
});
```

- [ ] **Step 3: Verify single Cypress run still works (no split env = all specs)**

The test stack must be running on port 3001/8001 for this step. Start it first:
```bash
mcp__server-runner__start_test
```

Then run Cypress without split env:
```bash
cd front
npx cypress run --headless
```

Expected: all specs run (no splitting when `split` env var is absent).

- [ ] **Step 4: Commit**

```bash
git add front/package.json front/package-lock.json front/cypress.config.ts
git commit -m "feat: add cypress-split for parallel spec distribution"
```

---

## Task 4: Write Python orchestration script

**Files:**
- Create: `scripts/e2e_parallel.py`

**Context:**
- `mariadb-test` Docker container runs on port 3307 with root password `rootpassword`
- Backend started via `uv run app_testing.py` (cwd: `api/`) — internally calls `reset()` which creates schema via Alembic
- Frontend started via `npm run dev` (cwd: `front/`)
- On Windows, npm must be called as `npm.cmd` or via `shell=True`
- Health check: backend at `GET /docs` (FastAPI always exposes this), frontend at `GET /`
- All env vars set via `subprocess.Popen(env=...)` — works cross-platform

- [ ] **Step 1: Create scripts/ directory if it doesn't exist**

```bash
mkdir -p scripts
```

- [ ] **Step 2: Write scripts/e2e_parallel.py**

```python
#!/usr/bin/env python3
"""
E2E parallel test runner for Mawster.

Usage:
    python scripts/e2e_parallel.py --workers 4

Each worker N gets:
  - Backend on port 8010+N  (MariaDB DB: mawster_test_N)
  - Frontend on port 3010+N (Next.js distDir: .next-3010+N)
  - Cypress instance with split=total,splitIndex=N
"""

import argparse
import atexit
import os
import platform
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).parent.parent
API_DIR = ROOT / "api"
FRONT_DIR = ROOT / "front"

BASE_API_PORT = 8010
BASE_FRONT_PORT = 3010
DB_PREFIX = "mawster_test_"
MARIADB_CONTAINER = "mariadb-test"
MARIADB_ROOT_PASSWORD = "rootpassword"
HEALTH_TIMEOUT = 120

IS_WINDOWS = platform.system() == "Windows"
NPM = "npm.cmd" if IS_WINDOWS else "npm"
NPX = "npx.cmd" if IS_WINDOWS else "npx"


def log(msg: str) -> None:
    print(f"[e2e-parallel] {msg}", flush=True)


def check_mariadb_running() -> None:
    """Verify the mariadb-test container is up."""
    result = subprocess.run(
        [
            "docker", "exec", MARIADB_CONTAINER,
            "mysql", "-uroot", f"-p{MARIADB_ROOT_PASSWORD}",
            "-e", "SELECT 1;",
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        log("ERROR: mariadb-test container is not running.")
        log("Start it with: make e2e-db")
        sys.exit(1)


def docker_create_db(worker: int) -> None:
    """CREATE DATABASE IF NOT EXISTS mawster_test_N via docker exec."""
    db = f"{DB_PREFIX}{worker}"
    log(f"Worker {worker}: creating database {db}...")
    result = subprocess.run(
        [
            "docker", "exec", MARIADB_CONTAINER,
            "mysql", "-uroot", f"-p{MARIADB_ROOT_PASSWORD}",
            "-e", f"CREATE DATABASE IF NOT EXISTS `{db}`;",
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Failed to create DB {db}: {result.stderr}")
    log(f"Worker {worker}: database {db} created.")


def wait_for_http(url: str, label: str, timeout: int = HEALTH_TIMEOUT) -> None:
    """Poll url until HTTP response received (any status code = server is up)."""
    import urllib.request
    import urllib.error

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=2)
            log(f"{label} ready at {url}")
            return
        except urllib.error.HTTPError:
            # Any HTTP error means the server responded — it's up
            log(f"{label} ready at {url}")
            return
        except Exception:
            time.sleep(0.5)
    raise TimeoutError(f"{label} at {url} did not become ready within {timeout}s")


def start_backend(worker: int, base_env: dict) -> subprocess.Popen:
    api_port = BASE_API_PORT + worker
    db = f"{DB_PREFIX}{worker}"
    env = {
        **base_env,
        "MODE": "testing",
        "MARIADB_DATABASE": db,
        "PORT": str(api_port),
    }
    log(f"Worker {worker}: starting backend on port {api_port} (DB: {db})...")
    return subprocess.Popen(
        ["uv", "run", "app_testing.py"],
        cwd=str(API_DIR),
        env=env,
    )


def start_frontend(worker: int, base_env: dict) -> subprocess.Popen:
    api_port = BASE_API_PORT + worker
    front_port = BASE_FRONT_PORT + worker
    env = {
        **base_env,
        "PORT": str(front_port),
        "API_PORT": str(api_port),
        "NEXTAUTH_URL": f"http://localhost:{front_port}",
    }
    log(f"Worker {worker}: starting frontend on port {front_port} (API: {api_port})...")
    return subprocess.Popen(
        [NPM, "run", "dev"],
        cwd=str(FRONT_DIR),
        env=env,
    )


def run_cypress(worker: int, total: int) -> int:
    """Run a Cypress instance for this worker, return exit code."""
    api_port = BASE_API_PORT + worker
    front_port = BASE_FRONT_PORT + worker
    log(f"Worker {worker}: launching Cypress (splitIndex={worker}/{total})...")
    result = subprocess.run(
        [
            NPX, "cypress", "run",
            "--env", f"backendUrl=http://localhost:{api_port},split={total},splitIndex={worker}",
            "--config", f"baseUrl=http://localhost:{front_port}",
        ],
        cwd=str(FRONT_DIR),
    )
    log(f"Worker {worker}: Cypress finished with exit code {result.returncode}")
    return result.returncode


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Mawster E2E tests in parallel.")
    parser.add_argument(
        "--workers", type=int, default=2,
        metavar="N", choices=range(1, 9),
        help="Number of parallel workers (1-8, default: 2)",
    )
    args = parser.parse_args()
    n = args.workers

    log(f"Starting E2E parallel run with {n} worker(s)...")
    check_mariadb_running()

    base_env = os.environ.copy()
    procs: list[subprocess.Popen] = []
    lock = threading.Lock()

    def cleanup() -> None:
        log("Shutting down all servers...")
        for p in procs:
            try:
                p.terminate()
            except Exception:
                pass
        for p in procs:
            try:
                p.wait(timeout=5)
            except Exception:
                try:
                    p.kill()
                except Exception:
                    pass

    atexit.register(cleanup)

    # Phase 1: create DBs and start servers in parallel
    errors: list[str] = []

    def setup_worker(worker: int) -> None:
        try:
            docker_create_db(worker)
            backend = start_backend(worker, base_env)
            frontend = start_frontend(worker, base_env)
            with lock:
                procs.extend([backend, frontend])
        except Exception as exc:
            with lock:
                errors.append(f"Worker {worker}: {exc}")

    threads = [threading.Thread(target=setup_worker, args=(i,)) for i in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    if errors:
        for err in errors:
            log(f"ERROR: {err}")
        sys.exit(1)

    # Phase 2: health checks in parallel
    log("Waiting for all servers to be ready...")
    health_errors: list[str] = []

    def health_check_worker(worker: int) -> None:
        try:
            wait_for_http(
                f"http://localhost:{BASE_API_PORT + worker}/docs",
                f"Backend {worker}",
            )
            wait_for_http(
                f"http://localhost:{BASE_FRONT_PORT + worker}",
                f"Frontend {worker}",
            )
        except TimeoutError as exc:
            with lock:
                health_errors.append(str(exc))

    health_threads = [threading.Thread(target=health_check_worker, args=(i,)) for i in range(n)]
    for t in health_threads:
        t.start()
    for t in health_threads:
        t.join()

    if health_errors:
        for err in health_errors:
            log(f"ERROR: {err}")
        sys.exit(1)

    # Phase 3: run Cypress workers in parallel
    log("All servers ready. Launching Cypress workers...")
    results: list[int] = [0] * n

    def cypress_worker(worker: int) -> None:
        results[worker] = run_cypress(worker, n)

    cypress_threads = [threading.Thread(target=cypress_worker, args=(i,)) for i in range(n)]
    for t in cypress_threads:
        t.start()
    for t in cypress_threads:
        t.join()

    exit_code = max(results)
    log(f"Done. {'All tests passed.' if exit_code == 0 else f'{sum(1 for r in results if r != 0)} worker(s) had failures.'}")
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Verify script is valid Python**

```bash
python scripts/e2e_parallel.py --help
```

Expected output:
```
usage: e2e_parallel.py [-h] [--workers N]
...
```

- [ ] **Step 4: Commit**

```bash
git add scripts/e2e_parallel.py
git commit -m "feat: add Python E2E parallel orchestration script"
```

---

## Task 5: Add Makefile target

**Files:**
- Modify: `Makefile` (root)

- [ ] **Step 1: Add e2e-parallel target to root Makefile**

Add after the existing `e2e` targets:

```makefile
e2e-parallel: ## Run E2E tests in parallel (N=2 by default, max 8)
	python scripts/e2e_parallel.py --workers $(if $(N),$(N),2)
```

Note: `$(or $(N),2)` uses N if provided, defaults to 2.

- [ ] **Step 2: Commit**

```bash
git add Makefile
git commit -m "feat: add make e2e-parallel target"
```

---

## Task 6: Smoke test with N=2

**Goal:** Verify the full parallel pipeline works end-to-end with 2 workers.

- [ ] **Step 1: Start mariadb-test container**

```bash
make e2e-db
```

Wait for container to be healthy.

- [ ] **Step 2: Run with 2 workers**

```bash
make e2e-parallel N=2
```

**Expected:**
- `mawster_test_0` and `mawster_test_1` databases created
- Backends start on 8010 and 8011
- Frontends start on 3010 and 3011
- Cypress splits specs: ~half on worker 0, ~half on worker 1
- All tests pass (or same failures as the known 3 failures on this branch)
- Script exits cleanly, all processes killed

- [ ] **Step 3: Verify cleanup on Ctrl+C**

Run `make e2e-parallel N=2`, then press Ctrl+C mid-run.

Expected: all backend and frontend processes terminate cleanly.

- [ ] **Step 4: If smoke test passes, final commit**

```bash
git add -A
git commit -m "test: verify e2e parallel smoke test with N=2"
```
