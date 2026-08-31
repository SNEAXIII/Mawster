# Mawster Tier List

A standalone React SPA for building **MCOC tier lists** — drag champions into tiers,
tag them with per-champion attributes, and export the result as JSON or a PNG.
Deployed to GitHub Pages; there is no backend and nothing leaves the browser.

Champion artwork and star frames are loaded from `https://www.mawster.app/static/…`.

## Develop

```bash
cd tierlist
npm install
npm run dev      # http://localhost:5173/mawster/
npm run build    # typecheck + production build into dist/
npm run preview  # serve the production build
```

## Champion data

`src/data/champions.json` is generated from the API fixture and committed —
the app never fetches a champion list at runtime, and champions cannot be added
from the UI.

```bash
node scripts/build-champions.mjs ../api/src/fixtures/champions_2026-08-26.json
```

Everything the fixture does not carry lives in **`src/data/overrides.ts`**, which is
the one file to edit by hand:

| Constant             | Purpose                                                                             |
| -------------------- | ----------------------------------------------------------------------------------- |
| `HARD_BANNED_IDS`    | Non-playable champions (bosses, minions). Dropped from the app entirely.            |
| `NOT_SEVEN_STAR_IDS` | Champions with no 7★ version, i.e. the exceptions behind the `7★ available` filter. |

Both lists are keyed by champion id — the slug of the name (`Abomination (Immortal)`
→ `abomination-immortal`). Ids are stable across regenerations, so a saved board
survives a data refresh.

> `NOT_SEVEN_STAR_IDS` ships empty: the fixture has no 7-star column, so every
> champion is currently treated as 7★-available. Fill it in (or regenerate from an
> export carrying `is_7_star`) to make that filter meaningful.

## Attributes

Seven per-champion tags, each of which is simultaneously a card badge, a pool
filter and an entry in the icon mockup:

| Key    | Badge          | Notes                                             |
| ------ | -------------- | ------------------------------------------------- |
| `atk`  | sword          |                                                   |
| `def`  | shield         |                                                   |
| `dual` | sword + shield |                                                   |
| `ga`   | flame          | "threat"                                          |
| `bg`   | trophy         | battlegrounds                                     |
| `asc`  | gold medal     |                                                   |
| `awk`  | gem            | carries a number, rendered as `x200` on the badge |

All three uses are driven from `ATTRIBUTES` in `src/lib/icons.tsx` — adding an
attribute or swapping an icon is a change to that one table.

### Icon mockup

The **Icons** button opens a picker showing every candidate icon per attribute
(Heroicons plus the hand-drawn ones Heroicons has no equivalent for, in
`src/components/custom-icons.tsx`). The choice applies immediately and is saved
with the board. Dropping in final artwork later means adding an entry to
`ATTRIBUTES[key].variants`, nothing else.

## Storage

| Key                       | Contents                                                                        |
| ------------------------- | ------------------------------------------------------------------------------- |
| `mawster-tierlist:board`  | tiers, attributes, icon choices, frame, title — this is what Export JSON writes |
| `mawster-tierlist:prefs`  | card size, name/badge visibility — per-browser, deliberately _not_ exported     |
| `mawster-tierlist:locale` | `en` / `fr`                                                                     |

An imported file is normalised before it is applied: unknown champion ids
(renamed, or newly hard-banned) are dropped rather than left as cards that
cannot be moved.

## PNG export

The board is captured with [snapdom](https://github.com/zumerlab/snapdom) at
2–4× so it stays readable when zoomed. Because the portraits are cross-origin,
this only works if the static host answers with `Access-Control-Allow-Origin`
(see `static-assets/nginx.conf.template`). The app probes for that header once at
startup: if it is missing, portraits are loaded without CORS so the artwork still
shows, and the PNG export reports why it cannot run.

## Deployment

`.github/workflows/tierlist-pages.yaml` builds `tierlist/` and publishes it to
GitHub Pages on every push to `main` that touches this directory. `VITE_BASE` is
set from the repository name, so the site is served at
`https://<owner>.github.io/<repo>/`. For a custom domain, set `VITE_BASE=/` and
add a `public/CNAME`.

Pages must be enabled once, in **Settings → Pages → Source: GitHub Actions**.
