# MCP Servers

Mawster ne déclare **aucun** serveur MCP : il n'y a pas de `.mcp.json`. Serveurs, tests, DB et
E2E passent par des commandes normales, exposées via les skills de `.claude/skills/`.

Un seul serveur est chargé, `context-mode`, et il vient du **plugin** déclaré dans
`.claude/settings.json`. Ne jamais le re-déclarer dans un `.mcp.json` : Claude chargerait deux
exemplaires de chaque outil (`mcp__context-mode__*` **et**
`mcp__plugin_context-mode_context-mode__*`). C'est déjà arrivé ; le `.mcp.json` a été supprimé.

Les serveurs `server-runner`, `cypress-runner`, `pytest-runner`, `db-manager` et `github` ont été
retirés — le dossier `mcp/` n'existe plus.

GitHub passe par le CLI `gh`, authentifié une fois via `gh auth login` (`/main-pr`, `/release-pr`).

Si un serveur MCP est un jour ajouté : **redémarrer Claude Code**, ils sont chargés au démarrage.
