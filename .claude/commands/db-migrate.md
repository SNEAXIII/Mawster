Gère les migrations Alembic sur la base de données.

## Actions selon $ARGUMENTS

| Argument           | Action                                                        |
| ------------------ | ------------------------------------------------------------- |
| (vide)             | Use `mcp__db-manager__migrate` to apply all pending migrations |
| `create <message>` | Run `make create-mig MIGRATION_MESSAGE="<message>"` in `api/` |
| `cancel`           | Run `make cancel-last` in `api/`                              |

Report the result. After `create`, remind to review the generated file before applying.
