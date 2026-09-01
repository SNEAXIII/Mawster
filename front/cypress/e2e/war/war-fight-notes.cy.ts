import { setupAssignedAttacker } from '../../support/e2e';

// The note popover only renders on nodes with an assigned attacker, so every test
// starts from setupAssignedAttacker (member's champion on BG1 node 10).
describe('War Fight Notes', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  function writeNote(text: string) {
    cy.getByCy('node-actions-trigger-node-10').click();
    cy.getByCy('war-note-input').type(text);
    cy.getByCy('war-note-save').click();
  }

  // Saving keeps the popover open — close it so the next open re-reads the note.
  function reopenNotePopover() {
    cy.get('body').type('{esc}');
    cy.getByCy('node-actions-trigger-node-10').click();
  }

  it('officer saves a note on a node via the popover', () => {
    setupAssignedAttacker('wfn1').then(({ ownerData }) => {
      cy.openWarAttackerPanel(ownerData.user_id);

      writeNote('Bait the special then heavy');
      reopenNotePopover();
      cy.getByCy('war-note-input').should('have.value', 'Bait the special then heavy');
    });
  });

  it('officer deletes a note from a node', () => {
    setupAssignedAttacker('wfn3').then(({ ownerData }) => {
      cy.openWarAttackerPanel(ownerData.user_id);

      writeNote('Delete me');
      cy.getByCy('war-note-delete').click();

      // Reopen — note is gone, delete button no longer shown
      reopenNotePopover();
      cy.getByCy('war-note-input').should('have.value', '');
      cy.getByCy('war-note-delete').should('not.exist');
    });
  });

  it('non-officer member sees the note read-only', () => {
    setupAssignedAttacker('wfn2').then(({ ownerData, memberData }) => {
      // Officer writes the note first
      cy.openWarAttackerPanel(ownerData.user_id);
      writeNote('Read only for members');

      // Member views — read-only, no editor
      cy.openWarAttackerPanel(memberData.user_id);
      cy.getByCy('node-actions-trigger-node-10').click();
      cy.getByCy('war-note-readonly').should('contain.text', 'Read only for members');
      cy.getByCy('war-note-input').should('not.exist');
    });
  });
});
