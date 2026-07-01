import { setupWarOwner } from '../../support/e2e';

describe('War share link', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('deep-links to the active war on the battlegroup from the URL', () => {
    setupWarOwner('share', 'ShareOwner', 'Share Alliance', 'SHR').then(
      ({ ownerData, allianceId }) => {
        // WarTab (and its BG picker / share button) only renders when the
        // alliance has an active war — create one first.
        cy.apiCreateWar(ownerData.access_token, allianceId, 'ShareEnemy');
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
        cy.apiCreateWar(ownerData.access_token, allianceId, 'ShareEnemy');
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

  it('updates the URL when the battlegroup is changed', () => {
    setupWarOwner('share', 'ShareOwner', 'Share Alliance', 'SHR').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'ShareEnemy');
        cy.apiLogin(ownerData.user_id);
        cy.visit(`/game/war?alliance=${allianceId}&bg=1`);

        cy.getByCy('bg-btn-2').click();
        cy.location('search').should('contain', 'bg=2');
        cy.location('search').should('contain', `alliance=${allianceId}`);
      }
    );
  });
});
