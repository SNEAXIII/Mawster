import { setupWarOwner } from '../../support/e2e';

describe('War share link', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('deep-links to the active war on the battlegroup from the URL', () => {
    setupWarOwner('share', 'ShareOwner', 'Share Alliance', 'SHR').then(
      ({ ownerData, allianceId }) => {
        cy.apiLogin(ownerData.user_id);
        cy.visit(`/game/war?alliance=${allianceId}&bg=2`);

        // BG2 is selected from the URL, not the default BG1.
        cy.getByCy('bg-btn-2').should('have.class', 'bg-primary');
      }
    );
  });

  it('copies a share link containing the alliance id and current bg', () => {
    setupWarOwner('share', 'ShareOwner', 'Share Alliance', 'SHR').then(
      ({ ownerData, allianceId }) => {
        cy.apiLogin(ownerData.user_id);
        cy.visit(`/game/war?alliance=${allianceId}&bg=2`);

        cy.window().then((win) => {
          cy.stub(win.navigator.clipboard, 'writeText').as('writeText').resolves();
        });

        cy.getByCy('share-war-link-btn').click();
        cy.get('@writeText').should(
          'have.been.calledWith',
          `${Cypress.config('baseUrl')}/game/war?alliance=${allianceId}&bg=2`
        );
      }
    );
  });
});
