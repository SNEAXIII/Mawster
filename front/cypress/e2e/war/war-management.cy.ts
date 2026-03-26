import { setupAllianceWithMember, setupWarOwner } from '../../support/e2e';

describe('War – Management (declare and end)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('officer can end a war via the end war button', () => {
    setupWarOwner('war-mgmt-end', 'EndWarOfficer', 'EndWarAlliance', 'EW').then(({ ownerData, allianceId }) => {
      cy.apiCreateWar(ownerData.access_token, allianceId, 'TargetEnemy');
      cy.apiLogin(ownerData.user_id);
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
  });

  it('member cannot end a war', () => {
    setupAllianceWithMember('war-mgmt-end-member', 'Owner', 'MemberUser', 'EndWarAlliance', 'EWA').then(
      ({ ownerData, memberData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'TargetEnemy');
        cy.apiLogin(memberData.user_id);
        cy.navTo('war');

        // Active war shows opponent name and end-war button
        cy.getByCy('war-opponent-name').should('contain', 'TargetEnemy');
        cy.getByCy('end-war-btn').should('not.exist');
      },
    );
  });
});
