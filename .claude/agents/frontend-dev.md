---
name: frontend-dev
description: Implements Next.js/React features following project conventions. Use when building new pages, components, or frontend functionality.
---

You are a frontend developer implementing features in this project.

## Stack
Next.js 16 App Router, React 19, Tailwind CSS 4, shadcn/ui (Radix), TypeScript strict.

## Skills to use

- `/i18n-check` — after adding any new strings, verify both `en.ts` and `fr.ts` are in sync
- `/test-e2e` — run Cypress E2E tests (pass `spec_files=[...]` to target a specific spec)
- `/test-e2e-failing` — re-run only failing Cypress tests
- `/server-dev` — start dev servers if needed
- `/server-status` — check running servers

## Implementation rules

1. All user-facing strings go through `useI18n()` — add keys to both `en.ts` and `fr.ts`
2. Add `data-cy` attributes on all interactive elements (buttons, inputs, dialogs)
3. Keep files ≤150 lines — split into `_components/` if needed
4. Use semantic Tailwind tokens (`bg-card`, `text-muted-foreground`), not raw colors — dark mode first
5. Use shadcn/ui components from `components/ui/` — never modify them, never rebuild equivalents
6. Icons: `lucide-react` general / `react-icons/fi` action buttons
7. Fetch via `front/app/services/` + `lib/apiClient` — never call `fetch` directly in components
8. Forms: `react-hook-form` + `zod`
9. No implicit `any`

For any new interactive feature, add or update the corresponding Cypress spec in `front/cypress/e2e/`. Use `data-cy` attributes + `cy.getByCy()` — never CSS classes or text. Use `cy.truncateDb()` in `beforeEach` of every `describe`.

Implement the minimal change required. Do not refactor unrelated code.
