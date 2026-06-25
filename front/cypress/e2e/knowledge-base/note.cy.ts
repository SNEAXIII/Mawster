import { setupKnowledgeBase, KB_SETUP_NOTE } from '../../support/e2e';

// setupKnowledgeBase freezes KB_SETUP_NOTE onto the node-1 fight record,
// authored by the alliance owner (pseudo `${prefix}Def`).
describe('Knowledge Base — note', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows the note author pseudo under the note cell', () => {
    const prefix = 'kb-noteauth';
    setupKnowledgeBase(prefix).then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.visit('/game/knowledge-base');

      const author = `${prefix}Def`.slice(0, 16);
      cy.getByCy('kb-note-author').should('have.length', 1).and('contain.text', `by ${author}`);
    });
  });

  it('opens a popover with the full note text and its author', () => {
    const prefix = 'kb-notepop';
    setupKnowledgeBase(prefix).then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.visit('/game/knowledge-base');

      const author = `${prefix}Def`.slice(0, 16);

      // No popover until the note is clicked.
      cy.getByCy('kb-note-popover').should('not.exist');

      cy.getByCy('kb-note-text').should('have.length', 1).click();

      cy.getByCy('kb-note-popover')
        .should('be.visible')
        .and('contain.text', KB_SETUP_NOTE)
        .and('contain.text', `by ${author}`);
    });
  });

  it('keeps the report flag available on a note', () => {
    const prefix = 'kb-noterep';
    setupKnowledgeBase(prefix).then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.visit('/game/knowledge-base');

      cy.getByCy('kb-note-report').should('have.length', 1).and('be.visible');
    });
  });
});
