import { nodeFlagButtonBehaviour } from './node-flag-button';

const behaviour = nodeFlagButtonBehaviour('planning-error', 'pe', (token, allianceId, warId, bg, node) => {
  cy.apiTogglePlanningError(token, allianceId, warId, bg, node);
});

describe('War – Planning Error', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Planning Error: visibility ───────────────────────────────────────────

  it('planning-error button is hidden when no attacker is assigned', behaviour.hiddenWithoutAttacker);
  it('planning-error button appears for officer after attacker is assigned', behaviour.visibleForOfficer);
  it('planning-error button is hidden for regular member', behaviour.hiddenForMember);

  // ── Planning Error: toggle ───────────────────────────────────────────────

  it('clicking planning-error button marks node as planning error', behaviour.marksNode);
  it('clicking planning-error button again unmarks the node', behaviour.unmarksNode);
});
