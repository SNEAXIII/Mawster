data-cy:
	@rg -o --hidden 'data-cy="[^"]*"|data-cy=\{`[^`]*`\}' | sed -E 's/data-cy="([^"]*)"/\1/; s/data-cy=\{`([^`]*)`\}/\1/' | sed -E 's/.*://' | sort -u