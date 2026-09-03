# The frontend is covered end to end, not by unit tests

There are no unit or component tests under `front/`, and none are planned. What covers the
frontend is 102 Cypress specs, sharded across 8 CI runners, driving a real browser against a
real API and a real database. The backend keeps its own unit and integration suites; the front
has only this.

This is a position, not an omission, and the reasoning is worth stating plainly: component
testing was not a technique this project's author had, and rather than write shallow tests
badly, the effort went into making the end-to-end layer thorough. That trade is defensible on
its own terms. A Cypress spec exercises the thing users actually touch — routing, data
fetching, the API contract, the rendered markup — where a mounted component asserts against a
mock of all four.

The specs are held to conventions that keep them from rotting: `cy.truncateDb()` in every
`describe`, `data-cy` attributes addressed through `cy.getByCy()` rather than classes or text,
and shared setup helpers (`setupAllianceOwner`, `setupWarOwner`, `setupAttackerScenario`) so a
schema change lands in one place.

## Consequences

The feedback loop is minutes, not milliseconds. Nothing can be tested in isolation: a hook, a
view-model or a pure formatting helper is only reachable by driving the whole application, so
edge cases that would be one assertion in a unit test are either an expensive spec or, in
practice, untested.

That gap is why the static layer matters more here than in a codebase with unit tests. After
the move to oxlint (ADR 0012), the linter is the only automated check that reads frontend code
without running it — which is also why the rules that survived the migration were chosen rather
than inherited.

Adding Vitest later contradicts nothing written here. The E2E layer was built to compensate for
an absence, and it stops being the whole story the moment something cheaper covers the same
ground. Anyone proposing it should know they are filling a known gap, not correcting an
oversight.
