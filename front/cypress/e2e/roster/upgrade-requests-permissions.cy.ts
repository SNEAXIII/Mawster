import { setupAllianceWithMember, setupUser, setupAdmin } from '../../support/e2e';

describe('Roster – Upgrade Requests (Permissions)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── 6. Regular member: no cancel button in another member's roster preview ─

  it("regular member cannot cancel upgrade requests in another member's roster preview", () => {
    setupAllianceWithMember('ur-t6', 'Black Widow', 'Skill').then(
      ({ ownerData, memberData: member2Data, allianceId, championUserId }) => {
        cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, '7r3');

        setupUser('ur-t6-member1').then((m1) => {
          cy.apiCreateGameAccount(m1.access_token, 'T6Member1', true).then((m1Acc) => {
            cy.apiForceJoinAlliance(m1Acc.id, allianceId);
            cy.apiLogin(m1.user_id);
            cy.navTo('alliances');

            // Regular member1 views member2's roster
            cy.getByCy('view-roster-ur-t6Member').click();

            // The upgrade requests section is NOT shown for regular members
            cy.getByCy('upgrade-requests-section').should('not.exist');
          });
        });
      },
    );
  });

  // ── 7. Regular member: no cancel button on own roster page ────────────────

  it('regular member cannot cancel upgrade requests on their own roster', () => {
    setupAllianceWithMember('ur-t7', 'Deadpool', 'Mutant').then(({ ownerData, memberData, championUserId }) => {
      cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, '7r3');

      cy.apiLogin(memberData.user_id);
      cy.navTo('roster');

      cy.getByCy('upgrade-requests-section').should('be.visible');
      cy.getByCy('upgrade-requests-section').click();
      cy.getByCy('cancel-upgrade-request').should('not.exist');
    });
  });

  // ── 8. Multiple upgrade requests show correct count ────────────────────────

  it('shows correct count for multiple upgrade requests', () => {
    setupAllianceWithMember('ur-t8', 'HulkMulti', 'Science').then(
      ({ ownerData, memberData, memberAccId, championUserId: cu1Id }) => {
        cy.apiCreateUpgradeRequest(ownerData.access_token, cu1Id, '7r3');

        // Reuse the admin created internally by setupAllianceWithMember (same discord_token: ur-t8-admin)
        setupAdmin('ur-t8-admin').then((admin) => {
          cy.apiLoadChampion(admin.access_token, 'ThanosMulti', 'Cosmic')
            .then((c2) => cy.apiAddChampionToRoster(memberData.access_token, memberAccId, c2[0].id, '7r1'))
            .then((cu2) => {
              cy.apiCreateUpgradeRequest(ownerData.access_token, cu2.id, '7r4');

              cy.apiLogin(memberData.user_id);
              cy.navTo('roster');

              cy.getByCy('upgrade-requests-section').should('be.visible');
              cy.getByCy('upgrade-requests-section').click();
              cy.getByCy('upgrade-request-item').should('have.length', 2);
            });
        });
      },
    );
  });

  // ── 9. Cancel on champion card cancels the pending request ─────────────────

  it('cancel button on champion card cancels the pending request (alliance dialog)', () => {
    setupAllianceWithMember('UR', 'SentryCard', 'Science').then(({ ownerData, championUserId }) => {
      cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, '7r3');

      cy.apiLogin(ownerData.user_id);
      cy.navTo('alliances');

      cy.getByCy('invite-member-toggle').should('be.visible');
      cy.getByCy('view-roster-URMember').click();

      cy.getByCy('cancel-pending-request').should('exist');
      cy.getByCy('cancel-pending-request').first().click({ force: true });

      cy.get('[role="alertdialog"]').contains('button', 'Cancel request').click();

      cy.getByCy('cancel-pending-request').should('not.exist');
      cy.getByCy('upgrade-requests-section').should('not.exist');
    });
  });
});
