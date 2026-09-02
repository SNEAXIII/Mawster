import { setupAllianceOwner, setupOwnerMemberAlliance } from '../../support/e2e';

describe('Alliances – Deletion', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Leader alone: can disband after retyping the alliance name
  // =========================================================================

  it('leader deletes their alliance after typing its name', () => {
    setupAllianceOwner('del-solo', 'SoloLeader', 'SoloAlliance', 'SOLO').then(({ userData }) => {
      cy.apiLogin(userData.user_id, 'alliances');

      cy.getByCy('alliance-card-SoloAlliance').should('be.visible');
      cy.getByCy('alliance-delete-toggle').should('not.be.disabled').click();

      cy.getByCy('alliance-delete-dialog').should('be.visible');
      cy.getByCy('confirmation-dialog-confirm').should('be.disabled');
      cy.getByCy('confirm-text-input').type('SoloAlliance');
      cy.getByCy('confirmation-dialog-confirm').should('not.be.disabled').click();

      // Gone from the list; the freed game account can create a new alliance
      cy.getByCy('alliance-card-SoloAlliance').should('not.exist');
      cy.getByCy('alliance-empty-state').should('be.visible');
      cy.getByCy('tab-create').should('be.visible');
    });
  });

  it('confirm stays disabled while the typed name is wrong', () => {
    setupAllianceOwner('del-typo', 'TypoLeader', 'TypoAlliance', 'TYPO').then(({ userData }) => {
      cy.apiLogin(userData.user_id, 'alliances');

      cy.getByCy('alliance-delete-toggle').click();
      cy.getByCy('confirm-text-input').type('typoalliance');
      cy.getByCy('confirmation-dialog-confirm').should('be.disabled');

      cy.getByCy('confirmation-dialog-cancel').click();
      cy.getByCy('alliance-card-TypoAlliance').should('be.visible');
    });
  });

  // =========================================================================
  // Someone else is still in: deletion is blocked
  // =========================================================================

  it('leader cannot delete while another member remains', () => {
    setupOwnerMemberAlliance('del-busy', 'BusyOwner', 'BusyMember', 'BusyAlliance', 'BUSY').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'alliances');

      cy.getByCy('alliance-card-BusyAlliance').should('be.visible');
      cy.getByCy('alliance-delete-toggle').should('be.disabled');
    });
  });

  // =========================================================================
  // Non-leaders never see the button
  // =========================================================================

  it('regular member does not see the delete button', () => {
    setupOwnerMemberAlliance('del-member', 'MemberOwner', 'MemberGuy', 'MemberAlliance', 'MBR').then(
      ({ memberData }) => {
        cy.apiLogin(memberData.user_id, 'alliances');

        cy.getByCy('alliance-card-MemberAlliance').should('be.visible');
        cy.getByCy('alliance-delete-toggle').should('not.exist');
      },
    );
  });
});
