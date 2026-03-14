import { setupUser, setupOwnerMemberAlliance } from '../../support/e2e';

describe('Alliances – Permissions', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Regular member restrictions (using force-join instead of invite+accept)
  // =========================================================================

  it('regular member cannot see invite button', () => {
    setupOwnerMemberAlliance('perm', 'PermOwner', 'PermMember', 'PermAlliance', 'PA').then(
      ({ memberData }) => {
        cy.uiLogin(memberData.login);
        cy.navTo('alliances');

        cy.getByCy('alliance-card-PermAlliance')
          .should('be.visible')
          .within(() => {
            cy.getByCy('invite-member-toggle').should('not.exist');
            cy.getByCy('member-row-PermMember').should('be.visible');
            cy.getByCy('member-row-PermOwner').should('be.visible');
          });
      }
    );
  });

  it('regular member cannot see pending invitations section', () => {
    setupOwnerMemberAlliance(
      'perm-pending',
      'PendingOwner',
      'PendingMember',
      'PendingAlliance',
      'PD'
    ).then(({ ownerData, memberData, allianceId }) => {
      // Create a third user and invite them (still pending)
      setupUser('perm-pending-third-token').then((third) => {
        cy.apiCreateGameAccount(third.access_token, 'ThirdPlayer', true).then((thirdAccount) => {
          cy.apiInviteMember(ownerData.access_token, allianceId, thirdAccount.id);
        });
      });

      cy.uiLogin(memberData.login);
      cy.navTo('alliances');
      cy.getByCy('alliance-card-PendingAlliance')
        .should('be.visible')
        .within(() => {
          // Regular member should NOT see the pending invitations section
          cy.contains('Pending invitations').should('not.exist');
        });
    });
  });

  it('regular member cannot see promote/demote/exclude buttons', () => {
    setupOwnerMemberAlliance(
      'perm-no-actions',
      'ActionsOwner',
      'ActionsMember',
      'ActionsAlliance',
      'AC'
    ).then(({ memberData }) => {
      cy.uiLogin(memberData.login);
      cy.navTo('alliances');

      cy.getByCy('alliance-card-ActionsAlliance')
        .should('be.visible')
        .within(() => {
          cy.getByCy('promote-officer-ActionsOwner').should('not.exist');
          cy.getByCy('exclude-member-ActionsOwner').should('not.exist');
          cy.getByCy('member-group-select').should('not.exist');
        });
    });
  });

  // =========================================================================
  // Officer permissions
  // =========================================================================

  it('officer can see invite button but not promote button', () => {
    setupOwnerMemberAlliance(
      'perm-officer',
      'OfficerOwner',
      'OfficerMember',
      'OfficerAlliance',
      'OF'
    ).then(({ ownerData, memberData, allianceId, memberAccId }) => {
      cy.apiAddOfficer(ownerData.access_token, allianceId, memberAccId);

      cy.uiLogin(memberData.login);
      cy.navTo('alliances');

      cy.getByCy('alliance-card-OfficerAlliance')
        .should('be.visible')
        .within(() => {
          cy.getByCy('invite-member-toggle').should('be.visible');
          cy.getByCy('promote-officer-OfficerOwner').should('not.exist');
          cy.getByCy('demote-officer-OfficerOwner').should('not.exist');
          cy.getByCy('member-group-select').should('exist');
        });
    });
  });
});
