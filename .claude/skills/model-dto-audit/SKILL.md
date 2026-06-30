---
name: model-dto-audit
description: >
  Audit SQLModel models and Pydantic DTOs for duplicated/inconsistent field
  definitions and propose DRY refactors (shared mixins, base classes, aligned
  constraints). Use this whenever the user wants to "keep the backend clean",
  reduce duplication between models, fix model/DTO inconsistency, factor repeated
  fields into a mixin, or before adding a model/DTO and worrying about drift —
  even if they don't say the word "audit". The whole point is single source of
  truth: a field defined once can't drift out of sync.
user-invocable: true
---

# Model / DTO consistency audit

The goal is **DRY**: a field declared in many places is a field that *will* drift,
and drift between a model column and its DTO (or between two models) is a silent
inconsistency bug. This skill finds that duplication and proposes factoring it
into a single source of truth. It reports; **the user approves before any edit.**

## Workflow

### 1. Run the analyzer

It is stdlib-only (`ast`) — no imports of the app, no DB. Run from the repo root:

```bash
python3 .claude/skills/model-dto-audit/scripts/audit_models_dtos.py
```

Flags: `--min-repeat N` (default 3) sets how many models must share a field
before it's flagged as a mixin candidate. Lower it to find smaller refactors.

The script parses every table model in `api/src/models/` and every DTO in
`api/src/dto/`, then prints a Markdown report with three sections. Read it in
full — don't re-derive its findings by hand.

### 2. Interpret the three sections

**Section 1 — Mixin candidates.** Identical field signatures repeated across
many models. These are the safe, high-value refactors because the column is
*already* identical everywhere — extracting it changes nothing at the DB level,
so **no migration is needed**. Typical wins in this codebase:

- `id` UUID primary key (in ~every model) → a `UUIDPrimaryKeyMixin`.
- `created_at` (`default_factory=datetime.now`) → a `TimestampMixin`.
- Constraint-bearing value fields that must stay in lockstep, e.g. `battlegroup`
  (`ge=1, le=3`) and `node_number` (`ge=1, le=50`) — repeated literally across
  several war models. A shared mixin (or a constrained type alias) means the
  bounds can only ever be defined once.

Foreign-key fields (`*_id`) repeat too, but each points at a *different* parent
table, so they're rarely worth a generic mixin — mention them only if the user
wants aggressive consolidation.

**Section 2 — Already-drifted duplicates.** The same field name defined in ≥2
models with *different* types or constraints. This is duplication that has
**already** caused an inconsistency — treat each as a bug to triage, not a
nice-to-have. For each, work out which definition is correct (ask the user when
it's a genuine domain question, e.g. should `WarFightRecord.stars` carry the same
`ge=6, le=7` bound as `WarDefensePlacement.stars`?) then either align them or
factor into one mixin so the divergence becomes impossible to reintroduce.

**Section 3 — Input-DTO validation gaps.** An input DTO (Request/Create/Update)
field that drops a model's `max_length`/`ge`/`le`/`pattern`, or flips
required↔Optional. These are **real validation gaps** — the API accepts input the
column would reject (or vice-versa). Fix by restoring the guard on the DTO.
Response DTOs are intentionally out of scope: omitting a guard on serialization
output is harmless, so reporting it would just be noise.

### 3. Present findings, then refactor on approval

Summarize as a short ranked list: **(a)** validation-gap bugs from section 3,
**(b)** drifted duplicates from section 2, **(c)** mixin extractions from section
1. Give a concrete proposal per item ("extract `id` + `created_at` into
`src/models/_mixins.py`; 28 models inherit it") and let the user pick what to
apply before you touch code.

## Constraints

- **Never propose renaming `date_connexion` or `id_user` on `LoginLog`** — that
  naming is accepted technical debt. The analyzer already excludes them from
  drift; keep them out of suggestions too.
- A pure mixin extraction that preserves identical column definitions needs **no
  migration**. But aligning a *drifted* field (section 2) can change a column's
  constraints — if so, route the schema change through the `/db-migrate` skill.
- After any backend edit, run `uvx ruff check` / `uvx ruff format`, and run the
  affected tests via the `/make` skill. Update tests alongside the change.
- Keep the report and suggestions concise; write nothing to the repo until the
  user has chosen what to refactor.
