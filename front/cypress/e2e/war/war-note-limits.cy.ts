import { setupAttackerScenario } from '../../support/e2e';

/**
 * The fight note is capped at 2000 chars, and saving is only allowed for a
 * non-empty note whose content actually differs from what is stored.
 */
describe('War note – input limit and save guard', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('caps the note at 2000 chars and gates save on a real, non-empty change', () => {
    setupAttackerScenario('notelim').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      // The note popover only renders on nodes with an assigned attacker.
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.apiLogin(ownerData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('node-actions-trigger-node-10').click();

      // Hard cap at 2000 characters.
      cy.getByCy('war-note-input').should('have.attr', 'maxlength', '2000');

      // Empty note → save disabled.
      cy.getByCy('war-note-save').should('be.disabled');

      // Non-empty → save enabled, then persist.
      cy.getByCy('war-note-input').type('First version');
      cy.getByCy('war-note-save').should('not.be.disabled').click();

      // Unchanged after save → save disabled again (no-op save is blocked).
      cy.getByCy('war-note-input').should('have.value', 'First version');
      cy.getByCy('war-note-save').should('be.disabled');

      // A real change re-enables save.
      cy.getByCy('war-note-input').type(' more');
      cy.getByCy('war-note-save').should('not.be.disabled');

      // Clearing entirely → disabled (empty).
      cy.getByCy('war-note-input').clear();
      cy.getByCy('war-note-save').should('be.disabled');

      // Whitespace-only counts as empty after trim → still disabled.
      cy.getByCy('war-note-input').type('   ');
      cy.getByCy('war-note-save').should('be.disabled');
    });
  });
});
