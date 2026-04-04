import { setupUser, setupOwnerMemberAlliance } from '../../support/e2e';

describe('Alliances – Permissions', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Regular member restrictions (using force-join instead of invite+accept)
  // =========================================================================

  it('regular member cannot see invite button', () => {
    setupOwnerMemberAlliance('perm', 'PermOwner', 'PermMember', 'PermAlliance', 'PA').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id);
      cy.navTo('alliances');

      cy.getByCy('alliance-card-PermAlliance')
        .should('be.visible')
        .within(() => {
          cy.getByCy('invite-member-toggle').should('not.exist');
          cy.getByCy('member-row-PermMember').should('be.visible');
          cy.getByCy('member-row-PermOwner').should('be.visible');
        });
    });
  });

  it('regular member cannot see pending invitations section', () => {
    setupOwnerMemberAlliance('perm-pending', 'PendingOwner', 'PendingMember', 'PendingAlliance', 'PD').then(
      ({ ownerData, memberData, allianceId }) => {
        // Create a third user and invite them (still pending)
        setupUser('perm-pending-third-token').then((third) => {
          cy.apiCreateGameAccount(third.access_token, 'ThirdPlayer', true).then((thirdAccount) => {
            cy.apiInviteMember(ownerData.access_token, allianceId, thirdAccount.id);
          });
        });

        cy.apiLogin(memberData.user_id);
        cy.navTo('alliances');
        cy.getByCy('alliance-card-PendingAlliance')
          .should('be.visible')
          .within(() => {
            // Regular member should NOT see the pending invitations section
            cy.contains('Pending invitations').should('not.exist');
          });
      },
    );
  });

  it('regular member cannot see promote/demote/exclude buttons', () => {
    setupOwnerMemberAlliance('perm-no-actions', 'ActionsOwner', 'ActionsMember', 'ActionsAlliance', 'AC').then(
      ({ memberData }) => {
        cy.apiLogin(memberData.user_id);
        cy.navTo('alliances');

        cy.getByCy('alliance-card-ActionsAlliance')
          .should('be.visible')
          .within(() => {
            cy.getByCy('promote-officer-ActionsOwner').should('not.exist');
            cy.getByCy('exclude-member-ActionsOwner').should('not.exist');
            cy.getByCy('member-group-select').should('not.exist');
          });
      },
    );
  });

  // =========================================================================
  // Officer permissions
  // =========================================================================

  it('officer can see invite button but not promote button', () => {
    setupOwnerMemberAlliance('perm-officer', 'OfficerOwner', 'OfficerMember', 'OfficerAlliance', 'OF').then(
      ({ ownerData, memberData, allianceId, memberAccId }) => {
        cy.apiAddOfficer(ownerData.access_token, allianceId, memberAccId);

        cy.apiLogin(memberData.user_id);
        cy.navTo('alliances');

        cy.getByCy('alliance-card-OfficerAlliance')
          .should('be.visible')
          .within(() => {
            cy.getByCy('invite-member-toggle').should('be.visible');
            cy.getByCy('promote-officer-OfficerOwner').should('not.exist');
            cy.getByCy('demote-officer-OfficerOwner').should('not.exist');
            cy.getByCy('member-group-select').should('exist');
          });
      },
    );
  });

  // =========================================================================
  // Owner actions — promote, demote, exclude
  // =========================================================================

  it('owner can promote a member to officer', () => {
    setupOwnerMemberAlliance('perm-promote', 'PromoteOwner', 'PromoteMember', 'PromoteAlliance', 'PR').then(
      ({ ownerData, allianceId }) => {
        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        cy.getByCy('alliance-card-PromoteAlliance')
          .should('be.visible')
          .within(() => {
            cy.getByCy('promote-officer-PromoteMember').should('be.visible').click();
          });

        cy.getByCy('confirmation-dialog-confirm').click();

        cy.getByCy('alliance-card-PromoteAlliance').within(() => {
          cy.getByCy('demote-officer-PromoteMember').should('be.visible');
          cy.getByCy('promote-officer-PromoteMember').should('not.exist');
        });
      },
    );
  });

  it('owner can demote an officer back to member', () => {
    setupOwnerMemberAlliance('perm-demote', 'DemoteOwner', 'DemoteMember', 'DemoteAlliance', 'DM').then(
      ({ ownerData, allianceId, memberAccId }) => {
        cy.apiAddOfficer(ownerData.access_token, allianceId, memberAccId);

        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        cy.getByCy('alliance-card-DemoteAlliance')
          .should('be.visible')
          .within(() => {
            cy.getByCy('demote-officer-DemoteMember').should('be.visible').click();
          });

        cy.getByCy('confirmation-dialog-confirm').click();

        cy.getByCy('alliance-card-DemoteAlliance').within(() => {
          cy.getByCy('promote-officer-DemoteMember').should('be.visible');
          cy.getByCy('demote-officer-DemoteMember').should('not.exist');
        });
      },
    );
  });

  it('owner can exclude a member from the alliance', () => {
    setupOwnerMemberAlliance('perm-exclude', 'ExcludeOwner', 'ExcludeMember', 'ExcludeAlliance', 'EX').then(
      ({ ownerData }) => {
        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        cy.getByCy('alliance-card-ExcludeAlliance')
          .should('be.visible')
          .within(() => {
            cy.getByCy('exclude-member-ExcludeMember').should('be.visible').click();
          });

        cy.getByCy('confirmation-dialog-confirm').click();

        cy.getByCy('alliance-card-ExcludeAlliance').within(() => {
          cy.getByCy('member-row-ExcludeMember').should('not.exist');
        });
      },
    );
  });
});
