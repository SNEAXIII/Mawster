import { setupUser, setupAdmin, type UserSetupData } from '../../support/e2e';

describe('Roster – Upgrade Requests', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  /**
   * Helper: create an alliance with an owner and a member using force-join.
   * Also loads a champion and adds it to the member's roster at 7r1.
   */
  function setupAllianceWithMember(
    adminToken: string,
    championName: string,
    championClass: string
  ) {
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
        // Force-join instead of invite + accept through UI
        cy.apiForceJoinAlliance(memberAccId, allianceId);
        return cy.apiLoadChampion(adminToken, championName, championClass);
      })
      .then((champs) => {
        champId = champs[0].id;
        return cy
          .apiAddChampionToRoster(memberData.access_token, memberAccId, champId, '7r1')
          .then((cu) => ({
            ownerData,
            memberData,
            allianceId,
            memberAccId,
            champId,
            championUserId: cu.id as string,
          }));
      });
  }

  // ── 1. Officer creates upgrade request via roster preview ──────────────────

  it('officer can request an upgrade for a member in the roster preview', () => {
    setupAdmin('ur-t1-admin').then((admin) => {
      setupAllianceWithMember(admin.access_token, 'Spider-Man', 'Science').then(({ ownerData }) => {
        cy.uiLogin(ownerData.login);
        cy.navTo('alliances');

        // Wait for alliance roles to load before opening roster dialog
        cy.getByCy('invite-member-toggle').should('be.visible');
        cy.getByCy('view-roster-URMember').click();

        // Click the upgrade button on the first champion card
        cy.getByCy('champion-upgrade').first().click({ force: true });

        // Select 7r3 in the rarity dropdown
        cy.getByCy('upgrade-rarity-select').click();
        cy.contains("[role='option']", '7★R3').click();

        // Confirm
        cy.getByCy('request-upgrade-btn').click();

        // The upgrade requests section should now be visible in the dialog
        cy.getByCy('upgrade-requests-section').should('be.visible');
        // Expand the collapsible (defaultOpen=false)
        cy.getByCy('upgrade-requests-section').click();
        cy.getByCy('upgrade-request-item').should('have.length', 1);
      });
    });
  });

  // ── 2. Member can see their own pending requests ───────────────────────────

  it('member can see their pending upgrade requests on their roster page', () => {
    setupAdmin('ur-t2-admin').then((admin) => {
      setupAllianceWithMember(admin.access_token, 'Wolverine', 'Mutant').then(
        ({ ownerData, memberData, championUserId }) => {
          cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, '7r3');

          cy.uiLogin(memberData.login);
          cy.navTo('roster');

          // The section is collapsed by default, need to expand it
          cy.getByCy('upgrade-requests-section').should('be.visible');
          cy.getByCy('upgrade-requests-section').click();
          cy.getByCy('upgrade-request-item').should('have.length', 1);
          cy.contains('Wolverine').should('be.visible');
        }
      );
    });
  });

  // ── 3. Request auto-completes when champion reaches target rarity ──────────

  it('upgrade request disappears when champion reaches the target rarity', () => {
    setupAdmin('ur-t3-admin').then((admin) => {
      setupAllianceWithMember(admin.access_token, 'Iron Man', 'Tech').then(
        ({ ownerData, memberData, championUserId }) => {
          cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, '7r3');

          // Verify the request is visible on the member's roster page
          cy.uiLogin(memberData.login);
          cy.navTo('roster');
          cy.getByCy('upgrade-requests-section').should('be.visible');

          // Upgrade champion 7r1 → 7r2 → 7r3 via API
          cy.apiUpgradeChampion(memberData.access_token, championUserId);
          cy.apiUpgradeChampion(memberData.access_token, championUserId);

          // Reload the page – the request should be gone (completed)
          cy.reload();
          cy.getByCy('upgrade-requests-section').should('not.exist');
        }
      );
    });
  });

  // ── 3b. Request stays when champion is upgraded but not to target ──────────

  it('upgrade request stays when champion is upgraded but not to the target rarity', () => {
    setupAdmin('ur-t3b-admin').then((admin) => {
      setupAllianceWithMember(admin.access_token, 'Magneto', 'Mutant').then(
        ({ ownerData, memberData, championUserId }) => {
          // Request 7r4 but champion is at 7r1
          cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, '7r4');

          cy.uiLogin(memberData.login);
          cy.navTo('roster');
          cy.getByCy('upgrade-requests-section').should('be.visible');

          // Upgrade 7r1 → 7r2 (still below 7r4)
          cy.apiUpgradeChampion(memberData.access_token, championUserId);

          cy.reload();
          // Request should still be visible because champion is at 7r2, not 7r4
          cy.getByCy('upgrade-requests-section').should('be.visible');
        }
      );
    });
  });

  // ── 3c. Request completes when champion is upgraded past target rarity ────

  it('upgrade request completes when champion is upgraded past the target rarity', () => {
    setupAdmin('ur-t3c-admin').then((admin) => {
      setupAllianceWithMember(admin.access_token, 'Cyclops', 'Mutant').then(
        ({ ownerData, memberData, championUserId }) => {
          // Request 7r2 but champion is at 7r1
          cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, '7r2');

          cy.uiLogin(memberData.login);
          cy.navTo('roster');
          cy.getByCy('upgrade-requests-section').should('be.visible');

          // Upgrade 7r1 → 7r2 → 7r3 (past target)
          cy.apiUpgradeChampion(memberData.access_token, championUserId);
          cy.apiUpgradeChampion(memberData.access_token, championUserId);

          cy.reload();
          // Request should be gone since champion rarity >= target rarity
          cy.getByCy('upgrade-requests-section').should('not.exist');
        }
      );
    });
  });

  // ── 4. Officer can cancel a member's upgrade request ──────────────────────

  it("officer can cancel a member's upgrade request in the roster preview", () => {
    setupAdmin('ur-t4-admin').then((admin) => {
      setupAllianceWithMember(admin.access_token, 'Thor', 'Cosmic').then(
        ({ ownerData, championUserId }) => {
          cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, '7r3');

          cy.uiLogin(ownerData.login);
          cy.navTo('alliances');

          // Wait for alliance roles to load before opening roster dialog
          cy.getByCy('invite-member-toggle').should('be.visible');
          cy.getByCy('view-roster-URMember').click();

          cy.getByCy('upgrade-requests-section').should('be.visible');
          // Expand the collapsible section (defaultOpen=false)
          cy.getByCy('upgrade-requests-section').click();
          cy.getByCy('cancel-upgrade-request').first().click();

          // Confirm in the dialog ("Cancel request" is the action button)
          cy.get('[role="alertdialog"]').contains('button', 'Cancel request').click();

          cy.getByCy('upgrade-requests-section').should('not.exist');
        }
      );
    });
  });

  // ── 5. Officer can cancel an upgrade request on their own roster ───────────

  it('officer can cancel an upgrade request on their own roster', () => {
    setupAdmin('ur-t5-admin').then((admin) => {
      let ownerData: UserSetupData;
      let ownerAccId: string;

      setupUser('ur-t5-owner')
        .then((owner) => {
          ownerData = owner;
          return cy.apiCreateGameAccount(owner.access_token, 'T5Owner', true);
        })
        .then((ownerAcc) => {
          ownerAccId = ownerAcc.id;
          return cy.apiCreateAlliance(ownerData.access_token, 'T5Alliance', 'T5', ownerAccId);
        })
        .then(() => {
          return cy.apiLoadChampion(admin.access_token, 'Captain America', 'Science');
        })
        .then((champs) => {
          return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r1');
        })
        .then((cu) => {
          // Owner creates a request on their own champion
          cy.apiCreateUpgradeRequest(ownerData.access_token, cu.id, '7r3');

          cy.uiLogin(ownerData.login);
          cy.navTo('roster');

          cy.getByCy('upgrade-requests-section').should('be.visible');
          // Expand the collapsible
          cy.getByCy('upgrade-requests-section').click();
          // The cancel button must be visible (owner has can_manage = true)
          cy.getByCy('cancel-upgrade-request').should('be.visible');
          cy.getByCy('cancel-upgrade-request').first().click();

          // Confirm in the dialog ("Cancel request" is the action button)
          cy.get('[role="alertdialog"]').contains('button', 'Cancel request').click();

          cy.getByCy('upgrade-requests-section').should('not.exist');
        });
    });
  });
});
