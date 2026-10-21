---
name: dev-browser
description: Piloter un navigateur sur le front Mawster local (localhost:3000) — se connecter via le dev-login, naviguer, cliquer, remplir, capturer l'écran, lire le DOM. Déclencheurs — "va sur [page]", "clique sur", "fais une capture", "regarde la page", "reproduis le bug dans le navigateur", "vérifie le rendu", ou toute interaction navigateur. Aussi pour reproduire un bug pendant `/qa` et vérifier un changement front avant de le dire fini.
---

# Dev Browser — Mawster

CLI qui pilote Chromium avec des scripts JavaScript sandboxés (QuickJS, pas Node : ni `fetch`, ni
`require`, ni `fs`). `dev-browser --help` donne l'API complète ; chaque page est un objet Playwright.

Installation, une fois par machine : `npm install -g dev-browser && dev-browser install`.

## Règles

- Toujours `--browser mawster` : le profil, donc le cookie de session, persiste entre deux scripts.
- Lancer les scripts via le tool **Bash** (heredoc `<<'EOF'`), pas PowerShell.
- Un script = une décision. Finir par un `console.log` de l'état utile à la suite, rien de plus.
- Cible : `http://localhost:3000` uniquement. Prod et staging seulement sur demande, en lecture.
- Connexion refusée sur `goto` → la stack n'est pas lancée : demander à l'utilisateur de lancer
  `docker compose -f compose-dev.yaml up -d`, `make run-dev` (`api/`) et `npm run dev` (`front/`).

## Connexion (dev-login)

Le login Discord est contourné en dev par la liste d'utilisateurs de `/login`. Par défaut, le
compte de l'utilisateur ; un autre joueur se choisit avec `dev-login-<login>`.

```bash
dev-browser --browser mawster <<'EOF'
const page = await browser.getPage("app");
await page.goto("http://localhost:3000/login");
await page.locator('[data-cy="dev-login-Misterbalise"]').click({ timeout: 10000 });
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 10000 });
console.log(page.url());
EOF
```

La page nommée `app` reste ouverte : les scripts suivants font `browser.getPage("app")` sans
renaviguer.

## Trouver un élément

1. `[data-cy="..."]` — les mêmes sélecteurs que Cypress (`cy.getByCy`). Les chercher dans le code.
2. `page.getByRole(...)` si aucun `data-cy` n'existe.
3. Page inconnue : `page.snapshotForAI({ track: "app", timeout: 5000 })`, puis `getByRef`.

Routes : `/game/account` (roster), `/game/alliances`, `/game/defense`, `/game/war`,
`/game/knowledge-base`, `/profile`, `/admin`.

## Captures

```js
const path = await saveScreenshot(await page.screenshot(), "war-bg2.png");
console.log(path); // ~/.dev-browser/tmp/war-bg2.png — à ouvrir avec Read pour la voir
```

Préférer un snapshot ou un `textContent` quand la question est textuelle ; une capture seulement
pour le rendu visuel.

## Dans le workflow

- **`/qa`** : reproduire le bug décrit avant de rédiger l'issue ; les étapes réellement suivies
  deviennent les « Steps to reproduce ». Pas de chemin de capture local dans l'issue.
- **Changement front** : ouvrir l'écran touché et vérifier le rendu avant d'annoncer que c'est fait.
- **Pas un substitut aux E2E** : un comportement qui doit rester vrai va dans un spec Cypress (CI).
- **Worktree** avec `node_modules` en jonction : le front tourne avec `next dev --webpack`.
