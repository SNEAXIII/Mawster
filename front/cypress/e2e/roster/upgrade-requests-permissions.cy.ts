import { setupUser, setupAdmin, type UserSetupData } from '../../support/e2e';

describe('Roster – Upgrade Requests (Permissions)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  /**
   * Helper: create an alliance with an owner and a member using force-join.
   * Also loads a champion and adds it to the member's roster at 7r1.
   */
  function setupAllianceWithMember(adminToken: string, championName: string, championClass: string) {
    let ownerData: UserSetupData;
    let memberData: UserSetupData;
    let allianceId: string;
    let memberAccId: string;
    let champId: string;

    return setupUser('ur-owner-token')
      .then((owner) => {
        ownerData = owner;
        return cy.apiCreateGameAccount(owner.access_token, 'UROwner', true);
      })
      .then((ownerAcc) => {
        return cy.apiCreateAlliance(ownerData.access_token, 'URAlliance', 'UR', ownerAcc.id);
      })
      .then((alliance) => {
        allianceId = alliance.id;
        return setupUser('ur-member-token');
      })
      .then((member) => {
        memberData = member;
        return cy.apiCreateGameAccount(member.access_token, 'URMember', true);
      })
      .then((memberAcc) => {
        memberAccId = memberAcc.id;
        cy.apiForceJoinAlliance(memberAccId, allianceId);
        return cy.apiLoadChampion(adminToken, championName, championClass);
      })
      .then((champs) => {
        champId = champs[0].id;
        return cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champId, '7r1').then((cu) => ({
          ownerData,
          memberData,
          allianceId,
          memberAccId,
          champId,
          championUserId: cu.id as string,
        }));
      });
  }

  // ── 6. Regular member: no cancel button in another member's roster preview ─

  it("regular member cannot cancel upgrade requests in another member's roster preview", () => {
    setupAdmin('ur-t6-admin').then((admin) => {
      let ownerData: UserSetupData;
      let member1UserId: string;
      let allianceId: string;
      let memberAccId: string;

      setupUser('ur-t6-owner')
        .then((owner) => {
          ownerData = owner;
          return cy.apiCreateGameAccount(owner.access_token, 'T6Owner', true);
        })
        .then((ownerAcc) => {
          return cy.apiCreateAlliance(ownerData.access_token, 'T6Alliance', 'T6', ownerAcc.id);
        })
        .then((alliance) => {
          allianceId = alliance.id;
          return setupUser('ur-t6-member2');
        })
        .then((m2) => {
          return cy
            .apiCreateGameAccount(m2.access_token, 'T6Member2', true)
            .then((acc) => {
              memberAccId = acc.id;
              cy.apiForceJoinAlliance(acc.id, allianceId);
              return cy.apiLoadChampion(admin.access_token, 'Black Widow', 'Skill');
            })
            .then((champs) => {
              return cy.apiAddChampionToRoster(m2.access_token, memberAccId, champs[0].id, '7r1');
            })
            .then((cu) => {
              cy.apiCreateUpgradeRequest(ownerData.access_token, cu.id, '7r3');
              return setupUser('ur-t6-member1');
            })
            .then((m1) => {
              member1UserId = m1.user_id;
              return cy.apiCreateGameAccount(m1.access_token, 'T6Member1', true);
            })
            .then((m1Acc) => {
              cy.apiForceJoinAlliance(m1Acc.id, allianceId);
              cy.apiLogin(member1UserId);
              cy.navTo('alliances');

              // Regular member1 views member2's roster
              cy.getByCy('view-roster-T6Member2').click();

              // The upgrade requests section is NOT shown for regular members
              cy.getByCy('upgrade-requests-section').should('not.exist');
            });
        });
    });
  });

  // ── 7. Regular member: no cancel button on own roster page ────────────────

  it('regular member cannot cancel upgrade requests on their own roster', () => {
    setupAdmin('ur-t7-admin').then((admin) => {
      setupAllianceWithMember(admin.access_token, 'Deadpool', 'Mutant').then(
        ({ ownerData, memberData, championUserId }) => {
          cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, '7r3');

          cy.apiLogin(memberData.user_id);
          cy.navTo('roster');

          // The section IS visible (member can see their requests)
          cy.getByCy('upgrade-requests-section').should('be.visible');
          // Expand the collapsible
          cy.getByCy('upgrade-requests-section').click();
          // But the cancel button is NOT shown (member has can_manage = false)
          cy.getByCy('cancel-upgrade-request').should('not.exist');
        },
      );
    });
  });

  // ── 8. Multiple upgrade requests show correct count ────────────────────────

  it('shows correct count for multiple upgrade requests', () => {
    setupAdmin('ur-t8-admin').then((admin) => {
      let ownerData: UserSetupData;
      let memberData: UserSetupData;
      let allianceId: string;
      let memberAccId: string;

      setupUser('ur-t8-owner')
        .then((owner) => {
          ownerData = owner;
          return cy.apiCreateGameAccount(owner.access_token, 'T8Owner', true);
        })
        .then((ownerAcc) => {
          return cy.apiCreateAlliance(ownerData.access_token, 'T8Alliance', 'T8', ownerAcc.id);
        })
        .then((alliance) => {
          allianceId = alliance.id;
          return setupUser('ur-t8-member');
        })
        .then((member) => {
          memberData = member;
          return cy.apiCreateGameAccount(member.access_token, 'T8Member', true);
        })
        .then((memberAcc) => {
          memberAccId = memberAcc.id;
          cy.apiForceJoinAlliance(memberAccId, allianceId);
          return cy.apiLoadChampion(admin.access_token, 'HulkMulti', 'Science');
        })
        .then((c1) => {
          return cy
            .apiAddChampionToRoster(memberData.access_token, memberAccId, c1[0].id, '7r1')
            .then((cu1) => {
              cy.apiCreateUpgradeRequest(ownerData.access_token, cu1.id, '7r3');
              return cy.apiLoadChampion(admin.access_token, 'ThanosMulti', 'Cosmic');
            })
            .then((c2) => {
              return cy.apiAddChampionToRoster(memberData.access_token, memberAccId, c2[0].id, '7r1');
            })
            .then((cu2) => {
              cy.apiCreateUpgradeRequest(ownerData.access_token, cu2.id, '7r4');

              cy.apiLogin(memberData.user_id);
              cy.navTo('roster');

              cy.getByCy('upgrade-requests-section').should('be.visible');
              // Expand
              cy.getByCy('upgrade-requests-section').click();
              cy.getByCy('upgrade-request-item').should('have.length', 2);
            });
        });
    });
  });

  // ── 9. Cancel on champion card cancels the pending request ─────────────────

  it('cancel button on champion card cancels the pending request (alliance dialog)', () => {
    setupAdmin('ur-t9-admin').then((admin) => {
      setupAllianceWithMember(admin.access_token, 'SentryCard', 'Science').then(({ ownerData, championUserId }) => {
        cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, '7r3');

        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        // Wait for alliance roles to load
        cy.getByCy('invite-member-toggle').should('be.visible');
        cy.getByCy('view-roster-URMember').click();

        // The cancel-pending-request button is on the champion card in the dialog
        cy.getByCy('cancel-pending-request').should('exist');
        cy.getByCy('cancel-pending-request').first().click({ force: true });

        // Confirm in the cancel confirmation dialog
        cy.get('[role="alertdialog"]').contains('button', 'Cancel request').click();

        // After cancelling the only request, the upgrade-requests-section should disappear
        // and the pending request button should be gone
        cy.getByCy('cancel-pending-request').should('not.exist');
        cy.getByCy('upgrade-requests-section').should('not.exist');
      });
    });
  });
});
