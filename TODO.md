# TODO

## SonarQube — Security Hotspots (Quality Gate FAILED)

### HIGH priority

- [ ] **Weak PRNG in DiscordAuthService** — replace `random` with `secrets` module
  - `api/src/services/DiscordAuthService.py:92, 113, 117`
- [ ] **Command injection in MCP servers** — review exec/spawn calls, sanitize args or mark as ACCEPTED
  - `mcp/cypress-runner/index.ts:201`
  - `mcp/db-manager/index.ts:42, 59`
  - `mcp/pytest-runner/index.ts:117`
  - `mcp/server-runner/index.ts:88, 266`
- [ ] **Dockerfile write permissions** — fix COPY with restrictive permissions
  - `front/front.Dockerfile:52, 53`

### MEDIUM priority

- [ ] **ReDoS — regex backtracking** — rewrite vulnerable regexes
  - `front/app/services/roster.ts:112, 120, 125`
  - `scripts/e2e_parallel.py:200`
- [ ] **Dockerfile recursive COPY** — avoid `COPY . .`, be explicit about what is copied
  - `front/front.Dockerfile:23`

### LOW / noise (review & mark ACCEPTED if intentional)

- [ ] **GitHub Actions — unpin dependencies** — use full commit SHA for all `uses:` in `.github/workflows/api_front__test_lint_build.yaml`
- [ ] **HTTP in tests** — false positives in `conftest.py`, `utils_client.py`, `generate_env.py` (local test URLs)
- [ ] **Math.random() in sidebar.tsx:649** — shadcn/ui component, likely safe to accept
