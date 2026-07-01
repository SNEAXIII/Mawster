---
name: component-dedup-audit
description: >
  Find duplicated or behaviourally-similar frontend components/hooks and propose
  mutualising them into a shared component or custom hook. Use whenever the user
  wants to "mutualiser les composants", "factoriser le front", reduce copy-paste
  in `front/`, spot repeated JSX/logic across pages, or clean up before adding a
  component and worrying about drift — even without the word "audit". Triggers on
  "mutualiser", "composants en double", "duplication front", "factoriser",
  "trucs en double", "dedup components".
user-invocable: true
---

# Component duplication audit (frontend)

The goal is **DRY** for React: a block of JSX or logic copy-pasted across pages
*will* drift, and two components that do the same thing written two ways are a
maintenance trap. This skill finds that duplication and proposes factoring it into
a single source of truth (a shared component or a custom hook).

**This is not scriptable.** A text-diff catches literal copy-paste, but the
valuable duplication here is *behavioural* — two dialogs, two empty-states, two
`useState`+fetch flows that do the same job written differently. Only reading and
understanding the files reveals that. So the method is: **cheap search to
shortlist candidates → you read and judge → propose → refactor on approval.**
It reports; **the user approves before any edit.**

## Scope

- **In:** `front/app/**/_components/`, `front/app/**/*.tsx` pages, shared
  `front/components/` (non-ui), custom hooks in `front/app/**/hooks/` or
  `lib/`.
- **Out — never touch:** `front/components/ui/` (shadcn/Radix — CLAUDE.md forbids
  editing or re-implementing these). If two components both wrap the same shadcn
  primitive, that's expected, not duplication.

## Workflow

### 1. Shortlist candidates (cheap search, not judgement)

Don't read 168 files. Use search to cluster likely duplicates down to a handful,
then only read those. Signals worth grepping/globbing for:

- **Sibling `_components` with near-identical filenames** across pages
  (`*Dialog.tsx`, `*EmptyState.tsx`, `*Table.tsx`, `*Filters.tsx`, `*Card.tsx`).
  Same suffix in ≥2 pages = read them together.
- **Repeated structural patterns.** Grep for recurring idioms:
  `ConfirmationDialog`, `data-cy=` dialogs, `if (loading)` / skeleton blocks,
  empty-state markup (`Aucun` / `No ... yet`), `useState` + `apiClient` fetch
  pairs, identical `columns` / table headers, repeated `zod` schemas.
- **Shared import fingerprints.** Files importing the same cluster of hooks/utils
  often reimplement the same flow. Use `Grep` to group by a distinctive import.
- **Size + name proximity.** Two files with similar names and similar line counts
  in different pages are prime suspects.

Keep the shortlist small (5–15 files max). Prefer the `Grep` tool or
`ctx_batch_execute` over dumping files into context.

### 2. Read the shortlist and judge (the non-scriptable part)

Read the shortlisted files and decide, for each cluster, which kind of duplication
it is:

- **Identical / copy-paste** — same JSX+logic, maybe renamed vars. Safe, high-value
  extraction.
- **Behaviourally the same, written differently** — same intent (confirm+delete,
  paginated table, filter bar) with divergent code. Mutualise into one component
  driven by **props**; this is where the real wins are.
- **Superficially similar, genuinely different** — same shadcn primitive or same
  layout but different domain meaning. **Leave it.** Forcing a shared abstraction
  here creates a worse coupling than the duplication. Say so explicitly.

For each real duplicate, note: the files involved, what varies between them (this
becomes the prop surface), and any i18n keys / `data-cy` attributes that must be
preserved.

### 3. Present findings, then refactor on approval

Summarise as a short ranked list, most valuable first: behavioural duplicates that
merge into one prop-driven component, then literal copy-paste extractions, then a
short "looked similar but leave alone" note so the user knows they were checked.
Give a concrete proposal per item — e.g. "merge `War*EmptyState` and
`Defense*EmptyState` into `front/app/_components/EmptyState.tsx` with `message` +
`icon` props; 4 call-sites" — and let the user pick what to apply before touching
code.

### 4. Apply (only what was approved)

- **Placement:** cross-page shared → `front/app/_components/` (or
  `front/components/` for pure presentational). Page-scoped stays in that page's
  `_components/`.
- **Props over copies:** what differs between the originals becomes props; keep the
  shared component dumb and typed (no implicit `any`).
- **i18n preserved:** all strings still go through `useI18n()` — never inline text
  while factoring. If keys diverged, add missing ones to both `en.ts` and `fr.ts`
  (`/i18n-check`).
- **Keep `data-cy`** attributes on interactive elements so existing Cypress specs
  keep passing; update call-sites, don't drop the hooks.
- **Files ≤150 lines** — if the shared component grows past that, split.

## Constraints

- **Report first, edit only on approval.** Write nothing to the repo until the user
  has chosen what to mutualise.
- **Never modify or re-implement `front/components/ui/`.**
- After edits: run `npm run build` from `front/` to catch TS/import errors. Do **not**
  run the Cypress suite locally — the CI pipeline validates E2E; a targeted spec run
  (`/test-e2e` with `spec_files=[...]`) only on explicit user request.
- If the change is broad or spans several pages, consider routing the actual
  refactor to the `frontend-dev` agent and the review to `frontend-reviewer`.
