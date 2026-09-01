import { setupAssignedAttacker } from '../../support/e2e';
import { nodeFlagButtonBehaviour } from './node-flag-button';

const behaviour = nodeFlagButtonBehaviour('fight-not-done', 'fnd', (token, allianceId, warId, bg, node) => {
  cy.apiToggleFightNotDone(token, allianceId, warId, bg, node);
});

describe('War – Fight Not Done', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Fight Not Done: visibility ───────────────────────────────────────────

  it('fight-not-done button is hidden when no attacker is assigned', behaviour.hiddenWithoutAttacker);
  it('fight-not-done button appears for officer after attacker is assigned', behaviour.visibleForOfficer);
  it('fight-not-done button is hidden for regular member', behaviour.hiddenForMember);

  // ── Fight Not Done: toggle ───────────────────────────────────────────────

  it('clicking fight-not-done button marks node as not done', behaviour.marksNode);
  it('clicking fight-not-done button again unmarks the node', behaviour.unmarksNode);

  // Specific to this flag: a completed combat leaves nothing to mark as not done.
  it('fight-not-done button is hidden after combat is completed', () => {
    setupAssignedAttacker('fnd-hidden-completed').then(({ memberData, ownerData, allianceId, warId }) => {
      cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
      cy.goToWarMode(ownerData.user_id, 'attackers');
      cy.getByCy('fight-not-done-node-10').should('not.exist');
    });
  });
});
