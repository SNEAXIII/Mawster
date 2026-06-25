import { setupAttackerScenario } from '../../support/e2e';

describe('War Fight Notes', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('officer saves a note on a node via the popover', () => {
    setupAttackerScenario('wfn1').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      // The note popover only renders on nodes with an assigned attacker.
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiLogin(ownerData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');

      cy.getByCy('node-actions-trigger-node-10').click();
      cy.getByCy('war-note-input').type('Bait the special then heavy');
      cy.getByCy('war-note-save').click();

      // Saving keeps the popover open; close it, then reopen — the note persists
      cy.get('body').type('{esc}');
      cy.getByCy('node-actions-trigger-node-10').click();
      cy.getByCy('war-note-input').should('have.value', 'Bait the special then heavy');
    });
  });

  it('non-officer member sees the note read-only', () => {
    setupAttackerScenario('wfn2').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      // Officer writes the note first
      cy.apiLogin(ownerData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('node-actions-trigger-node-10').click();
      cy.getByCy('war-note-input').type('Read only for members');
      cy.getByCy('war-note-save').click();

      // Member views — read-only, no editor
      cy.apiLogin(memberData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('node-actions-trigger-node-10').click();
      cy.getByCy('war-note-readonly').should('contain.text', 'Read only for members');
      cy.getByCy('war-note-input').should('not.exist');
    });
  });
});
