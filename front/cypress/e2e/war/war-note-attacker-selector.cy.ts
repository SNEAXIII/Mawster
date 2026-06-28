import { setupAttackerScenario } from '../../support/e2e';

const NOTE = 'Selector note content';

/**
 * The attacker selector embeds the same WarNoteEditor as the node popover, gated
 * to officers. This proves an officer can write and persist a note from within it.
 */
describe('War note – attacker selector', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('officer edits a fight note from inside the attacker selector', () => {
    setupAttackerScenario('selnote').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('war-mode-attackers').click();

      // Open the selector on node 10 and write a note via the embedded editor.
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');
      cy.getByCy('war-attacker-selector-note').within(() => {
        // Note section is folded by default — expand it before editing.
        cy.getByCy('war-note-input').should('not.exist');
        cy.getByCy('war-attacker-selector-note-toggle').click();
        cy.getByCy('war-note-input').type(NOTE);
        cy.getByCy('war-note-save').click();
        // Save leaves the editor open and, the note now being unchanged, disabled.
        cy.getByCy('war-note-save').should('be.disabled');
      });

      // Reopen the selector — the note persisted.
      cy.get('body').type('{esc}');
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-selector-note').within(() => {
        // A saved note is unfolded automatically on reopen — no toggle needed.
        cy.getByCy('war-note-input').should('have.value', NOTE);
      });
    });
  });

  it('keeps the fight note folded by default and toggles it open', () => {
    setupAttackerScenario('selfold').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('war-mode-attackers').click();

      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');
      cy.getByCy('war-attacker-selector-note').within(() => {
        // Folded by default: editor not rendered until the toggle is clicked.
        cy.getByCy('war-note-input').should('not.exist');
        cy.getByCy('war-attacker-selector-note-toggle').click();
        cy.getByCy('war-note-input').should('be.visible');
        // Toggling again collapses it back.
        cy.getByCy('war-attacker-selector-note-toggle').click();
        cy.getByCy('war-note-input').should('not.exist');
      });
    });
  });
});
