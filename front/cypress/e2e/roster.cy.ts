import { setupUser, setupAdmin, type UserSetupData } from "../support/e2e";

describe("Roster – UI", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it("shows no-accounts message when user has no game accounts", () => {
    setupUser("roster-noacc-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo("roster");
      cy.contains("create a game account first").should("be.visible");
    });
  });

  it("shows empty roster message", () => {
    setupUser("roster-empty-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "EmptyRoster", true);

      cy.uiLogin(login);
      cy.navTo("roster");
      cy.contains("roster is empty").should("be.visible");
    });
  });

  it("opens the Add Champion form and searches for a champion", () => {
    setupAdmin("roster-add-admin-token").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "Spider-Man", "Science");

      setupUser("roster-add-user-token").then(({ login, access_token }) => {
        cy.apiCreateGameAccount(access_token, "RosterPlayer", true);

        cy.uiLogin(login);
        cy.navTo("roster");

        // Open form
        cy.contains("Add / Update a Champion").click();

        // Search for champion
        cy.getByCy('champion-search').type("Spider");

        // Verify search results appear
        cy.contains("Spider-Man").should("be.visible");
      });
    });
  });

  it("adds a champion to the roster", () => {
    setupAdmin("roster-addchamp-admin-token").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "Wolverine", "Mutant");

      setupUser("roster-addchamp-user-token").then(
        ({ login, access_token }) => {
          cy.apiCreateGameAccount(access_token, "WolverinePlayer", true);

          cy.uiLogin(login);
          cy.navTo("roster");

          // Open form
          cy.contains("Add / Update a Champion").click();

          // Search and select champion
          cy.getByCy('champion-search').type("Wolverine");
          cy.getByCy('champion-result-Wolverine').click();

          // Select rarity (click 6★R4)
          cy.getByCy('rarity-6r4').click();

          // Submit
          cy.getByCy('champion-submit').click();

          cy.contains("Wolverine added / updated").should("be.visible");
          cy.contains("Wolverine").should("exist");
        }
      );
    });
  });

  it("deletes a champion from the roster", () => {
    setupAdmin("roster-del-admin-token").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "HulkDel", "Science");

      setupUser("roster-del-user-token").then(({ login, access_token }) => {
        cy.apiCreateGameAccount(access_token, "HulkPlayer", true);

        cy.uiLogin(login);
        cy.navTo("roster");

        // Add champion first
        cy.contains("Add / Update a Champion").click();
        cy.getByCy('champion-search').type("HulkDel");
        cy.getByCy('champion-result-HulkDel').click();
        cy.getByCy('rarity-6r4').click();
        cy.getByCy('champion-submit').click();
        cy.contains("HulkDel added / updated").should("be.visible");

        // Now delete the champion via the delete button on the card
        cy.getByCy('champion-delete').first().click({ force: true });

        // Confirm deletion dialog
        cy.get('[role="alertdialog"]')
          .should("be.visible")
          .contains("button", "Delete")
          .click();

        cy.contains("HulkDel removed from roster").should("be.visible");
      });
    });
  });

  it("shows account selector when user has multiple accounts", () => {
    setupUser("roster-multi-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "Account1", true);
      cy.apiCreateGameAccount(access_token, "Account2", false);

      cy.uiLogin(login);
      cy.navTo("roster");
      cy.contains("Select a game account").should("be.visible");
    });
  });

  it("hides upgrade requests section when no requests exist", () => {
    setupUser("roster-upgrades-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "UpgradeAcc", true);

      cy.uiLogin(login);
      cy.navTo("roster");
      // The Upgrade Requests component returns null when there are no requests
      cy.contains("Upgrade Requests").should("not.exist");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Upgrade Requests
// ─────────────────────────────────────────────────────────────────────────────

/** Helper: create owner alliance + invite member (member accepts via UI), then resolve with the ids. */
function setupAllianceWithMember(
  adminToken: string,
  championName: string,
  championClass: string,
) {
  let ownerData: UserSetupData;
  let memberData: UserSetupData;
  let allianceId: string;
  let memberAccId: string;
  let champId: string;

  return setupUser("ur-owner-token").then((owner) => {
    ownerData = owner;
    return cy.apiCreateGameAccount(owner.access_token, "UROwner", true);
  }).then((ownerAcc) => {
    return cy.apiCreateAlliance(ownerData.access_token, "URAlliance", "UR", ownerAcc.id);
  }).then((alliance) => {
    allianceId = alliance.id;
    return setupUser("ur-member-token");
  }).then((member) => {
    memberData = member;
    return cy.apiCreateGameAccount(member.access_token, "URMember", true);
  }).then((memberAcc) => {
    memberAccId = memberAcc.id;
    cy.apiInviteMember(ownerData.access_token, allianceId, memberAccId);

    cy.uiLogin(memberData.login);
    cy.navTo("alliances");
    cy.getByCy("accept-invitation").click();
    cy.contains("Invitation accepted").should("be.visible");

    return cy.apiLoadChampion(adminToken, championName, championClass);
  }).then((champs) => {
    champId = champs[0].id;
    return cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champId, "7r1").then((cu) => ({
      ownerData,
      memberData,
      allianceId,
      memberAccId,
      champId,
      championUserId: cu.id as string,
    }));
  });
}

describe("Roster – Upgrade Requests", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── 1. Officer creates upgrade request via roster preview ──────────────────

  it("officer can request an upgrade for a member in the roster preview", () => {
    setupAdmin("ur-t1-admin").then((admin) => {
      setupAllianceWithMember(admin.access_token, "Spider-Man", "Science").then(
        ({ ownerData }) => {
          cy.uiLogin(ownerData.login);
          cy.navTo("alliances");

          cy.getByCy("view-roster-URMember").click();

          // Click the upgrade button on the first champion card
          cy.getByCy("champion-upgrade").first().click({ force: true });

          // Select 7r3 in the rarity dropdown
          cy.getByCy("upgrade-rarity-select").click();
          cy.contains("[role='option']", "7★R3").click();

          // Confirm
          cy.getByCy("request-upgrade-btn").click();

          // The upgrade requests section should now be visible in the dialog
          cy.getByCy("upgrade-requests-section").should("be.visible");
          cy.getByCy("upgrade-request-item").should("have.length", 1);
        }
      );
    });
  });

  // ── 2. Member can see their own pending requests ───────────────────────────

  it("member can see their pending upgrade requests on their roster page", () => {
    setupAdmin("ur-t2-admin").then((admin) => {
      setupAllianceWithMember(admin.access_token, "Wolverine", "Mutant").then(
        ({ ownerData, memberData, championUserId }) => {
          cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, "7r3");

          cy.uiLogin(memberData.login);
          cy.navTo("roster");

          cy.getByCy("upgrade-requests-section").should("be.visible");
          cy.getByCy("upgrade-request-item").should("have.length", 1);
          cy.contains("Wolverine").should("be.visible");
        }
      );
    });
  });

  // ── 3. Request auto-completes when champion reaches target rarity ──────────

  it("upgrade request disappears when champion reaches the target rarity", () => {
    setupAdmin("ur-t3-admin").then((admin) => {
      setupAllianceWithMember(admin.access_token, "Iron Man", "Tech").then(
        ({ ownerData, memberData, championUserId }) => {
          cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, "7r3");

          // Verify the request is visible on the member's roster page
          cy.uiLogin(memberData.login);
          cy.navTo("roster");
          cy.getByCy("upgrade-requests-section").should("be.visible");

          // Upgrade champion 7r1 → 7r2 → 7r3 via API
          cy.apiUpgradeChampion(memberData.access_token, championUserId);
          cy.apiUpgradeChampion(memberData.access_token, championUserId);

          // Reload the page – the request should be gone
          cy.reload();
          cy.getByCy("upgrade-requests-section").should("not.exist");
        }
      );
    });
  });

  // ── 4. Officer can cancel a member's upgrade request ──────────────────────

  it("officer can cancel a member's upgrade request in the roster preview", () => {
    setupAdmin("ur-t4-admin").then((admin) => {
      setupAllianceWithMember(admin.access_token, "Thor", "Cosmic").then(
        ({ ownerData, championUserId }) => {
          cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, "7r3");

          cy.uiLogin(ownerData.login);
          cy.navTo("alliances");
          cy.getByCy("view-roster-URMember").click();

          cy.getByCy("upgrade-requests-section").should("be.visible");
          cy.getByCy("cancel-upgrade-request").first().click();

          // Confirm in the dialog
          cy.get('[role="alertdialog"]').contains("button", "Cancel").click();

          cy.getByCy("upgrade-requests-section").should("not.exist");
        }
      );
    });
  });

  // ── 5. Officer can cancel an upgrade request on their own roster ───────────

  it("officer can cancel an upgrade request on their own roster", () => {
    setupAdmin("ur-t5-admin").then((admin) => {
      let ownerData: UserSetupData;
      let ownerAccId: string;

      setupUser("ur-t5-owner").then((owner) => {
        ownerData = owner;
        return cy.apiCreateGameAccount(owner.access_token, "T5Owner", true);
      }).then((ownerAcc) => {
        ownerAccId = ownerAcc.id;
        return cy.apiCreateAlliance(ownerData.access_token, "T5Alliance", "T5", ownerAccId);
      }).then(() => {
        return cy.apiLoadChampion(admin.access_token, "Captain America", "Science");
      }).then((champs) => {
        return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r1");
      }).then((cu) => {
        // Owner creates a request on their own champion
        cy.apiCreateUpgradeRequest(ownerData.access_token, cu.id, "7r3");

        cy.uiLogin(ownerData.login);
        cy.navTo("roster");

        cy.getByCy("upgrade-requests-section").should("be.visible");
        // The cancel button must be visible (owner has can_manage = true)
        cy.getByCy("cancel-upgrade-request").should("be.visible");
        cy.getByCy("cancel-upgrade-request").first().click();

        cy.get('[role="alertdialog"]').contains("button", "Cancel").click();

        cy.getByCy("upgrade-requests-section").should("not.exist");
      });
    });
  });

  // ── 6. Regular member: no cancel button in another member's roster preview ─

  it("regular member cannot cancel upgrade requests in another member's roster preview", () => {
    setupAdmin("ur-t6-admin").then((admin) => {
      let ownerData: UserSetupData;
      let member1Login: string;
      let allianceId: string;
      let memberAccId: string;

      setupUser("ur-t6-owner").then((owner) => {
        ownerData = owner;
        return cy.apiCreateGameAccount(owner.access_token, "T6Owner", true);
      }).then((ownerAcc) => {
        return cy.apiCreateAlliance(ownerData.access_token, "T6Alliance", "T6", ownerAcc.id);
      }).then((alliance) => {
        allianceId = alliance.id;
        return setupUser("ur-t6-member2");
      }).then((m2) => {
        // Member2 is the one whose roster will have the upgrade request
        return cy.apiCreateGameAccount(m2.access_token, "T6Member2", true).then((acc) => {
          cy.apiInviteMember(ownerData.access_token, allianceId, acc.id);
          cy.uiLogin(m2.login);
          cy.navTo("alliances");
          cy.getByCy("accept-invitation").click();
          cy.contains("Invitation accepted").should("be.visible");
          memberAccId = acc.id;
          return cy.apiLoadChampion(admin.access_token, "Black Widow", "Skill");
        }).then((champs) => {
          return cy.apiAddChampionToRoster(ownerData.access_token, memberAccId, champs[0].id, "7r1");
        }).then((cu) => {
          cy.apiCreateUpgradeRequest(ownerData.access_token, cu.id, "7r3");
          return setupUser("ur-t6-member1");
        }).then((m1) => {
          member1Login = m1.login;
          return cy.apiCreateGameAccount(m1.access_token, "T6Member1", true);
        }).then((m1Acc) => {
          cy.apiInviteMember(ownerData.access_token, allianceId, m1Acc.id);
          cy.uiLogin(member1Login);
          cy.navTo("alliances");
          cy.getByCy("accept-invitation").click();
          cy.contains("Invitation accepted").should("be.visible");

          // Regular member1 views member2's roster
          cy.getByCy("view-roster-T6Member2").click();

          // The upgrade requests section is NOT shown for regular members
          cy.getByCy("upgrade-requests-section").should("not.exist");
        });
      });
    });
  });

  // ── 7. Regular member: no cancel button on own roster page ────────────────

  it("regular member cannot cancel upgrade requests on their own roster", () => {
    setupAdmin("ur-t7-admin").then((admin) => {
      setupAllianceWithMember(admin.access_token, "Deadpool", "Mutant").then(
        ({ ownerData, memberData, championUserId }) => {
          cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, "7r3");

          cy.uiLogin(memberData.login);
          cy.navTo("roster");

          // The section IS visible (member can see their requests)
          cy.getByCy("upgrade-requests-section").should("be.visible");
          // But the cancel button is NOT shown (member has can_manage = false)
          cy.getByCy("cancel-upgrade-request").should("not.exist");
        }
      );
    });
  });
});
