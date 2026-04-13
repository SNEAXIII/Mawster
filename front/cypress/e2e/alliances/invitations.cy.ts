import { setupUser, setupAllianceOwner } from '../../support/e2e';

describe('Alliances – Invitations', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('invites a member and verifies pending invitation content', () => {
    setupAllianceOwner('alliance-invite', 'OwnerAcc', 'InviteAlliance', 'IA').then(({ userData: ownerData }) => {
      setupUser('alliance-newmember-token').then((newMember) => {
        return cy.apiCreateGameAccount(newMember.access_token, 'NewMemberAcc', true);
      });

      cy.apiLogin(ownerData.user_id);
      cy.navTo('alliances');

      cy.getByCy('alliance-card-InviteAlliance').should('be.visible');

      cy.intercept('GET', '**/alliances/eligible-members').as('eligibleMembers');
      cy.getByCy('invite-member-toggle').click();
      cy.wait('@eligibleMembers');

      // Open combobox and select member
      cy.getByCy('invite-member-select').click();
      cy.contains("[role='option']", 'NewMemberAcc').click();

      cy.getByCy('invite-member-submit').click();
      cy.contains('Invitation sent successfully').should('be.visible');

      // Verify pending invitation content
      cy.contains('Pending invitations (1)').should('be.visible');
      cy.getByCy('pending-invitation-0').should('contain', 'NewMemberAcc');
      cy.getByCy('pending-invitation-0').should('contain', 'Invited by OwnerAcc');
    });
  });

  describe('Invite member combobox', () => {
    it('opens and shows eligible members', () => {
      setupAllianceOwner('combo-open', 'OwnerAcc', 'ComboAlliance', 'CA').then(({ userData: ownerData }) => {
        setupUser('combo-member-token').then((member) => {
          return cy.apiCreateGameAccount(member.access_token, 'EligibleAcc', true);
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        cy.intercept('GET', '**/alliances/eligible-members').as('eligibleMembers');
        cy.getByCy('invite-member-toggle').click();
        cy.wait('@eligibleMembers');

        cy.getByCy('invite-member-select').click();
        cy.contains("[role='option']", 'EligibleAcc').should('be.visible');
      });
    });

    it('filters members by typing', () => {
      setupAllianceOwner('combo-filter', 'OwnerAcc', 'FilterAlliance', 'FA').then(({ userData: ownerData }) => {
        setupUser('combo-filter-m1').then((m1) => {
          cy.apiCreateGameAccount(m1.access_token, 'AlphaPlayer', true);
        });
        setupUser('combo-filter-m2').then((m2) => {
          cy.apiCreateGameAccount(m2.access_token, 'BetaPlayer', true);
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        cy.intercept('GET', '**/alliances/eligible-members').as('eligibleMembers');
        cy.getByCy('invite-member-toggle').click();
        cy.wait('@eligibleMembers');

        cy.getByCy('invite-member-select').click();
        cy.get('[placeholder]').filter(':visible').type('Alpha');

        cy.contains("[role='option']", 'AlphaPlayer').should('be.visible');
        cy.contains("[role='option']", 'BetaPlayer').should('not.exist');
      });
    });

    it('shows no results message when filter matches nothing', () => {
      setupAllianceOwner('combo-empty', 'OwnerAcc', 'EmptyAlliance', 'EA').then(({ userData: ownerData }) => {
        setupUser('combo-empty-member').then((m) => {
          cy.apiCreateGameAccount(m.access_token, 'SomeMember', true);
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        cy.intercept('GET', '**/alliances/eligible-members').as('eligibleMembers');
        cy.getByCy('invite-member-toggle').click();
        cy.wait('@eligibleMembers');

        cy.getByCy('invite-member-select').click();
        cy.get('[placeholder]').filter(':visible').type('zzznomatch');

        cy.contains('No results found.').should('be.visible');
      });
    });

    it('shows selected member name in trigger after selection', () => {
      setupAllianceOwner('combo-select', 'OwnerAcc', 'SelectAlliance', 'SA').then(({ userData: ownerData }) => {
        setupUser('combo-select-member').then((m) => {
          cy.apiCreateGameAccount(m.access_token, 'PickedAcc', true);
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        cy.intercept('GET', '**/alliances/eligible-members').as('eligibleMembers');
        cy.getByCy('invite-member-toggle').click();
        cy.wait('@eligibleMembers');

        cy.getByCy('invite-member-select').click();
        cy.contains("[role='option']", 'PickedAcc').click();

        cy.getByCy('invite-member-select').should('contain.text', 'PickedAcc');
        cy.getByCy('invite-member-submit').should('not.be.disabled');
      });
    });
  });

  it('accepts an invitation via the UI and verifies alliance content', () => {
    setupAllianceOwner('alliance-accept', 'AccOwner', 'JoinAlliance', 'JA').then(
      ({ userData: ownerData, allianceId }) => {
        setupUser('alliance-accept-invitee-token').then((invitee) => {
          return cy.apiCreateGameAccount(invitee.access_token, 'JoinPlayer', true).then((inviteeAccount) => {
            cy.apiInviteMember(ownerData.access_token, allianceId, inviteeAccount.id);

            cy.apiLogin(invitee.user_id);
            cy.navTo('alliances');

            // Verify invitation content before accepting
            cy.getByCy('my-invitations-section').should('be.visible');
            cy.getByCy('my-invitation-JoinAlliance').should('contain', 'JoinAlliance');
            cy.getByCy('my-invitation-JoinAlliance').should('contain', '[JA]');
            cy.getByCy('my-invitation-JoinAlliance').should('contain', 'JoinPlayer');

            cy.getByCy('accept-invitation').click();
            cy.contains('Invitation accepted').should('be.visible');

            // After accepting, alliance card appears with correct member count
            cy.getByCy('alliance-card-JoinAlliance')
              .should('be.visible')
              .within(() => {
                cy.getByCy('alliance-member-count').should('contain', '2');
                cy.getByCy('member-row-JoinPlayer').should('be.visible');
                cy.getByCy('member-row-AccOwner').should('be.visible');
              });
          });
        });
      },
    );
  });

  it('owner sees invitation for their own second game account', () => {
    setupAllianceOwner('self-invite', 'OwnerAcc', 'SelfAlliance', 'SI').then(({ userData: ownerData, allianceId }) => {
      cy.apiCreateGameAccount(ownerData.access_token, 'SecondAcc', false).then((secondAccount) => {
        cy.apiInviteMember(ownerData.access_token, allianceId, secondAccount.id);

        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        // The invitation for the owner's own second account must be visible
        cy.getByCy('my-invitations-section').should('be.visible');
        cy.getByCy('my-invitation-SelfAlliance').should('contain', 'SelfAlliance');
        cy.getByCy('my-invitation-SelfAlliance').should('contain', '[SI]');
        cy.getByCy('my-invitation-SelfAlliance').should('contain', 'SecondAcc');

        // Owner can accept and the second account joins
        cy.getByCy('accept-invitation').click();
        cy.contains('Invitation accepted').should('be.visible');
        cy.getByCy('alliance-card-SelfAlliance').within(() => {
          cy.getByCy('alliance-member-count').should('contain', '2');
          cy.getByCy('member-row-SecondAcc').should('be.visible');
        });
      });
    });
  });

  it('declines an invitation via the UI', () => {
    setupAllianceOwner('alliance-decline', 'DeclineOwner', 'DeclineAlliance', 'DA').then(
      ({ userData: ownerData, allianceId }) => {
        setupUser('alliance-decline-invitee-token').then((invitee) => {
          return cy.apiCreateGameAccount(invitee.access_token, 'DeclinePlayer', true).then((inviteeAccount) => {
            cy.apiInviteMember(ownerData.access_token, allianceId, inviteeAccount.id);

            cy.apiLogin(invitee.user_id);
            cy.navTo('alliances');

            cy.getByCy('my-invitations-section').should('be.visible');
            cy.getByCy('decline-invitation').click();

            // After declining, invitations section disappears and no alliance card
            cy.getByCy('my-invitations-section').should('not.exist');
            cy.getByCy('alliance-empty-text').should('contain', 'No alliances yet');
          });
        });
      },
    );
  });
});
