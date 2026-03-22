import { setupWarOwner } from '../../support/e2e';

describe('War – Management (declare and end)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('officer can end a war via the end war button', () => {
    setupWarOwner('war-mgmt-end', 'EndWarOfficer', 'EndWarAlliance', 'EW').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'TargetEnemy').then(() => {
          cy.uiLogin(ownerData.login);
          cy.navTo('war');

          // Active war shows opponent name and end-war button
          cy.getByCy('war-opponent-name').should('contain', 'TargetEnemy');
          cy.getByCy('end-war-btn').should('be.visible').click();

          // Confirm dialog
          cy.getByCy('confirmation-dialog-confirm').click();

          // After ending: declare button visible, map gone
          cy.getByCy('declare-war-btn').should('be.visible');
          cy.getByCy('war-node-1').should('not.exist');
        });
      }
    );
  });
});
