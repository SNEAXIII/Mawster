# Frontend lint rules are opt-in, and refusals are written down

`.oxlintrc.json` turns the `correctness` category off and re-enables 364 rules by name.
Nothing is inherited: a rule oxlint ships, implements and would happily run stays silent
until someone types it into that list. The upside is that every rule in the file was
looked at once by a person. The cost is that the file is the whole contract — there is no
category quietly covering the rest.

That cost is not theoretical. `react/no-unstable-nested-components` has been implemented
in oxlint the whole time, with a message near-identical to Sonar's. It was never in the
list, so a component defined inside another one — rebuilt on every render, remounting its
subtree instead of updating it — reached `main` twice and was reported by SonarCloud
after the push rather than by the lint before it. Two tools, two rule sets, and the slower
one finding it first.

So the bar for adding a rule is that it catches a defect with an observable cost —
a remount, a mutation, a promise nobody awaits — and not a house style. Under that bar the
overwhelming majority of what oxlint could say is noise: `react-in-jsx-scope` fires 909
times and is obsolete under the JSX transform, `one-var` 606 times, `jsx-max-depth` 332,
`sort-imports` 295, `no-magic-numbers` 292, `id-length` 281. None of them describes a bug.
Enabling them would bury the handful of rules that do.

Refusing a rule is a decision too, and the reason belongs here rather than in a reviewer's
memory:

- **`unicorn/no-array-sort`** (23 occurrences) — refuses *every* form of `sort()`,
  including `[...a].sort()` and `a.filter(…).sort()` where the mutation is harmless, and
  demands `toSorted()`. That is Baseline 2023; the project targets ES2017 and uses it
  nowhere. The rule's real subject — accidental mutation — has a compatible fix the rule
  rejects, so it would buy a browser-support change and nothing else.
- **`typescript/no-misused-promises`** (111) and **`react/set-state-in-effect`** (39) —
  both name real hazards, and both need reading each site to tell a bug from a deliberate
  fire-and-forget or a legitimate sync. Worth doing; not worth doing in one pass.
- **`react/button-has-type`** (47) — a bare `<button>` inside a `<form>` submits by
  design, and stamping `type='button'` across 47 of them would silently disarm whichever
  ones relied on it.
- **`eqeqeq`** (28) and **`no-eq-null`** (25) — `x == null` is the idiom for "null or
  undefined" and is written on purpose here. Auto-fixing it to `=== null` changes
  behaviour.

Rules can also contradict each other, and the config has to say which one wins.
`consistent-type-imports` at its default splits `import { A, type B }` into two
declarations from the same module, which is exactly what `no-duplicate-imports` forbids:
switching both on took violations from 15 to 48. `fixStyle: "inline-type-imports"`
settles it — one import per module, `type` on the specifier.

## Consequences

Every oxlint upgrade ships rules this repository will not run. Nobody is told; the new
rule is simply absent from the list and stays quiet. Harvesting them is a deliberate
errand, not something that happens by upgrading.

SonarCloud therefore stays load-bearing rather than decorative. It is the only thing
reading the rules the local lint was never told about, and it reports on the pull request
— after the push, after the branch, sometimes after a second push. Findings arriving from
Sonar that oxlint could have caught are a signal to add the rule, not just to fix the
line.

Adding a rule starts with `npx oxlint -D <rule> app components hooks`, because the count
decides the shape of the work: one violation is a fix, forty is a project, and a hundred
usually means the rule disagrees with a convention the codebase made on purpose. A rule
proposed without that number cannot be judged.

This is the rule-level half of [0012](0012-tooling-favours-speed-at-equal-quality.md),
which covers picking the linter itself. That ADR asks what a new tool stops catching;
this one is where the answer gets recorded when the tool is kept and a rule is turned
down.
