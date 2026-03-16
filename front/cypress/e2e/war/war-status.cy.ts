import { setupWarOwner } from '../../support/e2e';

describe('War – Ended war status', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('defenders tab shows no-active-war message when selected war is ended', () => {
    setupWarOwner('war-status-ended', 'StatusOfficer', 'StatusAlliance', 'ST').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'StatusEnemy').then((war) => {
          cy.apiEndWar(ownerData.access_token, allianceId, war.id);

          cy.uiLogin(ownerData.login);
          cy.navTo('war');

          // War is auto-selected (only one war) — switch directly to defenders tab
          cy.getByCy('tab-war-defenders').click();

          // Should show no-active-war message, not the map
          cy.contains('No active war').should('be.visible');
          cy.getByCy('war-node-1').should('not.exist');
        });
      }
    );
  });
});
