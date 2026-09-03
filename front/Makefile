.PHONY: help check fix format format-check types all data-cy

help:
	@echo "check        --> eslint, no writes (mirrors api's 'make check')"
	@echo "fix          --> eslint --fix"
	@echo "format       --> prettier --write ."
	@echo "format-check --> prettier --check ., no writes"
	@echo "types        --> tsc --noEmit"
	@echo "all          --> fix, then format, then types"
	@echo "data-cy      --> list every data-cy selector in the codebase"

# Both delegate to the npm scripts rather than calling eslint directly, so a target
# and its npm counterpart can never drift apart on the same flags.
check:
	npm run lint:check

fix:
	npm run lint

format:
	npm run format

format-check:
	npm run format:check

# The pre-commit hook runs eslint and prettier but never tsc, so a type error only
# surfaces at `next build`. This is the cheap way to catch it before pushing.
types:
	npx tsc --noEmit

# fix before format: eslint --fix rewrites code, prettier gets the last word on layout —
# the same order the pre-commit hooks run in.
all:
	$(MAKE) fix
	$(MAKE) format
	$(MAKE) types

data-cy:
	@rg -o --hidden 'data-cy="[^"]*"|data-cy=\{`[^`]*`\}' | sed -E 's/data-cy="([^"]*)"/\1/; s/data-cy=\{`([^`]*)`\}/\1/' | sed -E 's/.*://' | sort -u
