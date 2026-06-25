import { setupAttackerScenario } from '../../support/e2e';

const NOTE = 'Defender note';

/**
 * A note on a node must surface as a badge on the defenders map view
 * (war-tab derives noteNodes from placements carrying a note).
 */
describe('War note – defenders map badge', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('badges a noted node on the defenders map view', () => {
    setupAttackerScenario('notemap').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      // Officer writes a note on node 10 from the attackers view popover.
      cy.apiLogin(ownerData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('node-actions-trigger-node-10').click();
      cy.getByCy('war-note-input').type(NOTE);
      cy.getByCy('war-note-save').click();
      cy.get('body').type('{esc}');

      // Switching to the defenders map view badges the noted node.
      cy.getByCy('war-mode-defenders').click();
      cy.getByCy('war-node-has-note-10').should('exist');
    });
  });
});
