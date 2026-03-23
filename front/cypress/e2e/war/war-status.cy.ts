import { setupWarOwner } from '../../support/e2e';

describe('War – Ended war status', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows no-war message after war ends', () => {
    setupWarOwner('war-status-ended', 'StatusOfficer', 'StatusAlliance', 'ST').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'StatusEnemy').then((war) => {
          cy.apiEndWar(ownerData.access_token, allianceId, war.id);

          cy.uiLogin(ownerData.login);
          cy.navTo('war');

          // After ending, getCurrentWar returns 404 → currentWar = null
          cy.contains('No war declared').should('be.visible');
          cy.getByCy('war-node-1').should('not.exist');
        });
      }
    );
  });
});
