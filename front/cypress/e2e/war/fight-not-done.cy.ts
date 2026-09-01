import { setupAssignedAttacker } from '../../support/e2e';
import { itBehavesLikeANodeFlagButton } from './node-flag-button';

describe('War – Fight Not Done', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  itBehavesLikeANodeFlagButton('fight-not-done', 'fnd', (token, allianceId, warId, bg, node) => {
    cy.apiToggleFightNotDone(token, allianceId, warId, bg, node);
  });

  // Specific to this flag: a completed combat leaves nothing to mark as not done.
  it('fight-not-done button is hidden after combat is completed', () => {
    setupAssignedAttacker('fnd-hidden-completed').then(({ memberData, ownerData, allianceId, warId }) => {
      cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
      cy.goToWarMode(ownerData.user_id, 'attackers');
      cy.getByCy('fight-not-done-node-10').should('not.exist');
    });
  });
});
