import { setupOwnerMemberAlliance } from '../../support/e2e';

describe('Alliance ownership transfer', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('transfer button visible only for officers, not plain members', () => {
    setupOwnerMemberAlliance('transfer-vis', 'TransferOwner', 'PlainMember', 'TransferAlliance', 'TRA').then(
      ({ ownerData, allianceId, memberAccId }) => {
        // plain member — button must NOT appear
        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');
        cy.getByCy('alliance-card-TransferAlliance')
          .should('be.visible')
          .within(() => {
            cy.getByCy('member-actions-PlainMember').click();
          });
        cy.getByCy(`transfer-owner-PlainMember`).should('not.exist');

        // promote to officer
        cy.apiAddOfficer(ownerData.access_token, allianceId, memberAccId);
        cy.reload();

        cy.getByCy('alliance-card-TransferAlliance')
          .should('be.visible')
          .within(() => {
            cy.getByCy('member-actions-PlainMember').click();
          });
        cy.getByCy('transfer-owner-PlainMember').should('be.visible');
      },
    );
  });

  it('confirm button disabled until correct pseudo typed', () => {
    setupOwnerMemberAlliance('transfer-input', 'InputOwner', 'InputOfficer', 'InputAlliance', 'INP').then(
      ({ ownerData, allianceId, memberAccId }) => {
        cy.apiAddOfficer(ownerData.access_token, allianceId, memberAccId);

        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        cy.getByCy('alliance-card-InputAlliance')
          .should('be.visible')
          .within(() => {
            cy.getByCy('member-actions-InputOfficer').click();
          });
        cy.getByCy('transfer-owner-InputOfficer').click();

        // wrong pseudo → confirm disabled
        cy.getByCy('confirm-text-input').type('wrongpseudo');
        cy.getByCy('confirmation-dialog-confirm').should('be.disabled');

        // correct pseudo → confirm enabled
        cy.getByCy('confirm-text-input').clear().type('InputOfficer');
        cy.getByCy('confirmation-dialog-confirm').should('not.be.disabled');
      },
    );
  });

  it('owner transfers leadership to officer — roles swap in UI', () => {
    setupOwnerMemberAlliance('transfer-swap', 'SwapOwner', 'SwapOfficer', 'SwapAlliance', 'SWP').then(
      ({ ownerData, allianceId, memberAccId }) => {
        cy.apiAddOfficer(ownerData.access_token, allianceId, memberAccId);

        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        cy.getByCy('alliance-card-SwapAlliance')
          .should('be.visible')
          .within(() => {
            cy.getByCy('member-actions-SwapOfficer').click();
          });
        cy.getByCy('transfer-owner-SwapOfficer').click();

        cy.getByCy('confirm-text-input').type('SwapOfficer');
        cy.getByCy('confirmation-dialog-confirm').click();

        // SwapOfficer is now leader, SwapOwner is officer
        cy.getByCy('alliance-card-SwapAlliance').within(() => {
          cy.contains('SwapOfficer').should('be.visible');
          cy.contains('SwapOwner').should('be.visible');
        });

        // transfer-owner button no longer visible (SwapOwner is now officer, current user)
        cy.getByCy('transfer-owner-SwapOfficer').should('not.exist');
      },
    );
  });

  it('officer cannot see transfer button on other officers', () => {
    setupOwnerMemberAlliance('transfer-officer-vis', 'OfficerOwner', 'OfficerMember', 'OfficerAlliance', 'OFA').then(
      ({ ownerData, allianceId, memberData, memberAccId }) => {
        cy.apiAddOfficer(ownerData.access_token, allianceId, memberAccId);

        cy.apiLogin(memberData.user_id);
        cy.navTo('alliances');

        cy.getByCy('alliance-card-OfficerAlliance')
          .should('be.visible')
          .within(() => {
            // officer sees the owner's actions menu but no transfer button
            cy.getByCy('member-actions-OfficerOwner').should('not.exist');
          });
      },
    );
  });
});
