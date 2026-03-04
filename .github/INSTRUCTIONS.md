# AI Coding Instructions — Mawster (Cesi_Zen)

## Project Overview

Mawster is a MCOC (Marvel Contest of Champions) alliance management tool.
- **Backend**: FastAPI + SQLModel + MariaDB (async), Python 3.12, managed with **uv**
- **Frontend**: Next.js 14 (App Router, Turbopack), React 19, Tailwind CSS, shadcn/ui
- **Auth**: Discord OAuth2 → NextAuth → Backend JWT (HS256)
- **i18n**: Custom hook `useI18n()` with EN/FR locale files in `front/app/i18n/locales/`

For full architecture details, see `.ai-context.md` at the project root.

---

## Backend Rules (`api/`)

### Commands — Use the Makefile

Always run commands from `api/` directory via `make`:

| Task | Command |
|------|---------|
| Run dev server | `make run-dev` |
| Create migration | `make create-mig MIGRATION_MESSAGE="description"` |
| Apply migrations | `make migrate` |
| Run tests | `make test` |
| Run tests with coverage | `make test-cov` |
| Load fixtures (dev) | `make fixtures` |
| Reset database | `make reset-db` |
| Install deps | `make install-dev` |

**Never** run raw `pytest`, `alembic`, or `uvicorn` commands directly.

### Testing

- **Always update tests** when modifying backend code (unit and/or integration).
- Tests live in `api/tests/unit/` and `api/tests/integration/`.
- Integration tests use `httpx.AsyncClient` with SQLite in-memory — no external DB needed.
- Run tests with `make test` (which uses `uv run pytest tests -v --tb=short -n 6`).
- Test helpers: `tests/utils/` (client helpers, constants, DB loaders).
- Setup helpers: `tests/integration/endpoints/setup/` (user, game, alliance factories).

### Linting

Finish every backend change session with:
```bash
uvx ruff check
```
Fix any issues before committing.

### Patterns

- **Async everywhere**: all DB operations are `await`, sessions are `AsyncSession`.
- **Service layer**: controllers delegate to stateless service classes in `src/services/`.
- **DTOs**: Pydantic `BaseModel` in `src/dto/` for request/response schemas.
- **Auth**: `AuthService.get_current_user_in_jwt` via `Depends()`.
- **Relationships**: must use `selectinload()` explicitly (no lazy loading in async SQLModel).
- **Errors**: raise `HTTPException` with proper status codes.

---

## Frontend Rules (`front/`)

### Component Guidelines

- **Refactor large components**: if a component exceeds ~150 lines, split it into smaller sub-components in the same `_components/` directory.
- **Custom hooks**: extract shared state logic into hooks in `front/hooks/` (e.g., `use-debounce.ts`, `use-mobile.ts`).
- **shadcn/ui**: primitives live in `components/ui/` — never modify these directly. App components in `components/` subdirectories.

### Conventions

- **i18n**: always use `const { t } = useI18n()` — never hardcode user-visible strings. Add keys to both `en.ts` and `fr.ts`.
- **API calls**: use `apiClient` from `app/lib/apiClient` (auto-attaches JWT).
- **Services**: API call wrappers in `app/services/` (e.g., `roster.ts`, `defense.ts`, `game.ts`).
- **Styling**: Tailwind CSS classes, dark mode first (`bg-card`, `text-muted-foreground`, etc.).
- **Icons**: `lucide-react` for general icons, `react-icons/fi` (Feather) for action buttons.

### File Organisation

```
front/
├── app/
│   ├── game/
│   │   ├── roster/          # Roster pages
│   │   │   ├── page.tsx     # Page component
│   │   │   └── _components/ # Page-specific components
│   │   ├── defense/         # Defense pages
│   │   └── alliances/       # Alliance pages
│   ├── i18n/locales/        # EN/FR translation files
│   ├── services/            # API service wrappers
│   └── lib/                 # Utilities, auth, constants
├── components/              # Shared components
│   ├── ui/                  # shadcn/ui primitives (don't edit)
│   └── roster/              # Reusable roster components
└── hooks/                   # Custom React hooks
```

---

## General Rules

1. **Language**: all code, comments, and variable names in **English**.
2. **Commits**: use conventional commits (`feat:`, `fix:`, `refactor:`, `test:`).
3. **No manual migrations**: always use `make create-mig MIGRATION_MESSAGE="..."`.
4. **Tests first**: update tests before or alongside code changes, then run `make test`.
5. **Lint last**: run `uvx ruff check` at the end of every backend session and `npm run build` for the frontend.
6. **Docker**: images are `sneaxiii/mawster-api` and `sneaxiii/mawster-front`. Watchtower auto-deploys.
