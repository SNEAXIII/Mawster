# Mawster – Implementation Report

## Summary of Changes

This document details all changes made during this implementation session.

---

## 1. Internationalization (i18n) System

### Created Files
- **`front/app/i18n/locales/en.ts`** – English translation file (default language). Contains all UI strings organized by section: common, nav, landing, login, register, profile, dashboard.
- **`front/app/i18n/locales/fr.ts`** – French translation file. Mirrors the exact same structure as `en.ts`.
- **`front/app/i18n/index.tsx`** – i18n provider and hook. Uses React Context + localStorage (key: `mawster-locale`). Default locale: `en`.
- **`front/app/ui/language-switcher.tsx`** – Toggle button component with flag emojis (🇬🇧 / 🇫🇷).

### Modified Files (i18n Integration)
- **`front/app/providers.tsx`** – Wrapped children with `I18nProvider`.
- **`front/app/layout.tsx`** – Changed `lang='fr'` → `lang='en'`.
- **`front/app/page.tsx`** – Added i18n for landing page texts.
- **`front/app/login/page.tsx`** – All French strings replaced with `t.login.*`.
- **`front/app/register/page.tsx`** – All French strings replaced with `t.register.*`.
- **`front/app/profile/page.tsx`** – All French strings replaced with `t.profile.*`. Date formatting is now locale-aware.
- **`front/app/dashboard/page.tsx`** – Error messages use `t.dashboard.errors.*`.
- **`front/app/ui/left-nav-bar/sidenav.tsx`** – Language switcher added, all labels translated.
- **`front/app/ui/left-nav-bar/nav-links.tsx`** – Link names use `t.nav.*`.
- **`front/app/ui/dashboard/table/table-header.tsx`** – Column headers and dropdown labels translated.
- **`front/app/ui/dashboard/table/user-cells.tsx`** – Date formatting locale-aware, status texts translated.
- **`front/app/ui/dashboard/actions/user-actions.tsx`** – All action labels and dialog texts translated.
- **`front/app/ui/dashboard/dialogs/confirmation-dialog.tsx`** – Default button texts changed to English.
- **`front/app/ui/dashboard/pagination/pagination-controls.tsx`** – "Page" and "Reset" labels translated.
- **`front/app/ui/dashboard/pagination/page-number-selector.tsx`** – "per page" and "Default" labels translated.
- **`front/app/lib/utils.ts`** – `formatDateInFrenchShort`/`formatDateInFrenchLong` renamed to `formatDateShort`/`formatDateLong` and now accept a `locale` parameter.

> **Note:** API messages were NOT translated (as requested – to be done later).

---

## 2. PlantUML Diagrams Update

All three diagram files were updated to:
1. **Reflect actual implemented models** (User with UUID PK, LoginLog)
2. **Include new models** (Alliance, GameAccount, Champion, ChampionUser)
3. **Translate everything to English**
4. **Keep planned future entities** (DefenseConfiguration, Node, DefensePlacement)

### Updated Files
- **`api/docs/mdc.puml`** – Conceptual Data Model
- **`api/docs/diag_class.puml`** – Class Diagram
- **`api/docs/mld.puml`** – Logical Data Model

### Key Changes vs Previous Diagrams
| Aspect | Before | After |
|--------|--------|-------|
| Language | French | English |
| User PK type | `int` | `UUID` |
| User fields | discord_username | login, avatar_url, disabled_at, deleted_at, etc. |
| Role enum | Membre/Adjoint/Chef/Admin | USER/ADMIN |
| LoginLog | Missing | Added |
| GameAccount.alliance_id | Required FK | **Nullable** FK |
| Alliance | Had `image_url` | Has `description` + TODO for url |
| Champion | No `is_7_star` | Added `is_7_star` |

---

## 3. New API Models

### Created Model Files
- **`api/src/models/Alliance.py`** – Alliance model (id, name, tag, description, created_at). TODO comment for url field.
- **`api/src/models/GameAccount.py`** – GameAccount model (id, user_id FK, alliance_id nullable FK, game_pseudo, is_primary, created_at).
- **`api/src/models/Champion.py`** – Champion model (id, name, champion_class, image_url, is_7_star).
- **`api/src/models/ChampionUser.py`** – ChampionUser model (id, game_account_id FK, champion_id FK, stars, rank, level, signature).

### Modified Files
- **`api/src/models/User.py`** – Added `game_accounts` relationship.
- **`api/src/models/__init__.py`** – Registered all 4 new models.

---

## 4. New API Endpoints

### Controller: `api/src/controllers/game_controller.py`
All endpoints require authentication (JWT).

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/game/accounts` | Create a game account (pseudo + is_primary) |
| `GET` | `/game/accounts` | List current user's game accounts |
| `POST` | `/game/alliances` | Create an alliance (name, tag, description) |
| `POST` | `/game/champion-users` | Add a champion to a game account roster |

### Security
- `POST /game/champion-users` verifies the game account belongs to the current user before allowing the operation.
- IDs are auto-generated (no client-provided IDs).

### Supporting Files
- **`api/src/dto/dto_game.py`** – DTOs for all game endpoints (create requests + responses).
- **`api/src/services/GameService.py`** – Business logic for GameAccount, Alliance, and ChampionUser operations.
- **`api/main.py`** – Registered `game_controller` router.

---

## 5. Champion Fixture Script

### Created File
- **`api/src/fixtures/load_champions.py`** – Script to load champions from a CSV file.

### Expected CSV Format
```csv
name,champion_class,image_url,is_7_star
Spider-Man (Classic),Science,https://example.com/spiderman.png,False
Doctor Doom,Mystic,https://example.com/doom.png,True
```

### Usage
```bash
python -m src.fixtures.load_champions
# or with custom CSV path:
python -m src.fixtures.load_champions --csv path/to/champions.csv
```

The script skips champions that already exist (matched by name) and reports counts.

> **Note:** The CSV file (`api/src/fixtures/champions.csv`) needs to be created manually with the champion data.

---

## 6. Database Migration

### Created File
- **`api/migrations/versions/a1b2c3d4e5f6_add_game_models.py`** – Alembic migration creating 4 new tables: `alliance`, `game_account`, `champion`, `champion_user`.

### To Apply
```bash
cd api
alembic upgrade head
```

---

## 7. Issues & Notes

- **No issues encountered** during implementation.
- **API messages remain in French** as requested – i18n for the backend will be handled separately.
- **Alliance URL field** is intentionally absent – marked with TODO in model, diagram, and migration.
- **Champions CSV** file needs to be created by the user.
- The `formatDateInFrenchShort` / `formatDateInFrenchLong` functions were renamed to `formatDateShort` / `formatDateLong` — any external references to the old names will need updating (all internal references were updated).

---

## TODOs Left
- [ ] Create `champions.csv` with actual champion data
- [ ] Add `url` field to Alliance model when ready
- [ ] Add i18n to API backend messages
- [ ] Implement DefenseConfiguration, Node, DefensePlacement models (future)
- [ ] Run `alembic upgrade head` to apply the migration
