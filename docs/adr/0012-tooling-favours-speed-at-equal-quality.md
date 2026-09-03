# Tooling is replaced for speed, never at the cost of coverage

The toolchain has been rebuilt piece by piece rather than chosen once: `uv` for dependencies,
Ruff for Python linting and formatting, oxlint for the frontend, the `gh` CLI where an MCP
server used to sit. The pattern is not an accident and it is not novelty-chasing — the rule is
that a faster tool wins **only** when it covers what the one it replaces covered.

That qualifier is the whole decision, and there is a worked example of it failing. oxfmt was
measured against Prettier on this repository: identical output across 420 files, checked in both
directions, and roughly three times faster. It was still refused, because it sits at version
0.66 and a formatter that changes its mind between releases rewrites every file in the
repository — a risk with no counterpart on the lint side, where a changed rule produces a
handful of warnings to triage. Speed lost to stability.

The same test applied to oxlint gave the opposite answer, and not for free either: the migration
dropped `sonarjs/prefer-read-only-props`, because oxlint runs ESLint plugins without giving them
typescript-eslint's parser services, so every type-aware plugin rule goes silent. That loss was
accepted against 161 additional rules and a lint that went from ~12s to 3.9s. It was a trade,
made with both numbers on the table.

## Consequences

Migrations are frequent, and each one costs a working day of measurement — benchmarks, rule
inventories, equivalence checks — because the rule demands evidence rather than a changelog
claim. A decision taken on reputation alone is not this rule being applied.

The stack drifts towards young tooling. `uv`, Ruff and oxlint are all pre-1.0 or nearly so, all
from the same generation of Rust-based rewrites, and a project betting on several at once is
exposed to any of them stalling. The mitigation is that each replaced a tool that still exists
and still works, so every one of these moves is reversible.

Anyone proposing the next replacement owes two numbers: what it makes faster, and what it stops
catching. Without the second, the answer is no — that is what oxfmt's rejection is there to
demonstrate.
