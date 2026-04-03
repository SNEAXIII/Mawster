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

## SonarQube — Code Duplication (Quality Gate: 4.7% > 3% threshold)

### Quick fix (recommended)

- [ ] **Exclude E2E and i18n from CPD** — add `sonar-project.properties` at root:
  ```properties
  sonar.cpd.exclusions=front/cypress/**,front/app/i18n/locales/**
  ```
  Rationale: duplication in tests is intentional; `en.ts`/`fr.ts` are translations (94.2% dupe expected)

### Refactor (optional, worst offenders)

- [ ] **`front/cypress/e2e/roster/upgrade-requests.cy.ts`** — 66.5% duplicated (11 blocks) — extract shared setup to helpers
- [ ] **`front/cypress/e2e/roster/rarity-signature.cy.ts`** — 59.8% (9 blocks)
- [ ] **`front/cypress/e2e/alliances/edge-cases.cy.ts`** — 53.8% (23 blocks)
- [ ] **`front/cypress/e2e/game-accounts/ui.cy.ts`** — 53.3% (5 blocks)
- [ ] **`front/cypress/e2e/roster/upgrade-requests-permissions.cy.ts`** — 52.8% (5 blocks)

---

### LOW / noise (review & mark ACCEPTED if intentional)

- [ ] **GitHub Actions — unpin dependencies** — use full commit SHA for all `uses:` in `.github/workflows/api_front__test_lint_build.yaml`
- [ ] **HTTP in tests** — false positives in `conftest.py`, `utils_client.py`, `generate_env.py` (local test URLs)
- [ ] **Math.random() in sidebar.tsx:649** — shadcn/ui component, likely safe to accept
