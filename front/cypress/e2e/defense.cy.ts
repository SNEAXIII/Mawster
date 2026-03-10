import { setupUser, setupAdmin, type UserSetupData, BACKEND } from "../support/e2e";

describe("Defense – UI", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Basic page rendering
  // =========================================================================

  it("shows no-alliance message when user has no alliances", () => {
    setupUser("def-noalliance-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo("defense");
      cy.contains("need to join an alliance").should("be.visible");
    });
  });

  it("shows the defense page with alliance and BG selectors", () => {
    setupUser("def-page-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "DefPlayer", true).then((account) => {
        cy.apiCreateAlliance(access_token, "DefAlliance", "DA", account.id);
      });

      cy.uiLogin(login);
      cy.navTo("defense");

      cy.contains("Defense Placement").should("be.visible");
      cy.contains("Alliance:").should("be.visible");
      cy.contains("Battlegroup:").should("be.visible");
      cy.getByCy("defense-bg-1").should("be.visible");
      cy.getByCy("defense-bg-2").should("be.visible");
      cy.getByCy("defense-bg-3").should("be.visible");
    });
  });

  it("switches between battlegroups", () => {
    setupUser("def-bg-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "BGPlayer", true).then((account) => {
        cy.apiCreateAlliance(access_token, "BGAlliance", "BG", account.id);
      });

      cy.uiLogin(login);
      cy.navTo("defense");

      cy.getByCy("defense-bg-2").click();
      cy.getByCy("defense-bg-3").click();
      cy.getByCy("defense-bg-1").click();
      cy.getByCy("defense-bg-1").should("be.visible");
    });
  });

  it("shows the Members side panel", () => {
    setupUser("def-members-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "MembersPlayer", true).then((account) => {
        cy.apiCreateAlliance(access_token, "MembersAlliance", "MP", account.id);
      });

      cy.uiLogin(login);
      cy.navTo("defense");
      cy.contains("Members").should("be.visible");
    });
  });

  // =========================================================================
  // Permissions: export / import visibility
  // =========================================================================

  it("export and import buttons are visible to the alliance owner", () => {
    setupUser("def-owner-export-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "ExportOwner", true).then((acc) => {
        cy.apiCreateAlliance(access_token, "ExportAlliance", "EA", acc.id);
      });
      cy.uiLogin(login);
      cy.navTo("defense");
      cy.getByCy("defense-export").should("be.visible");
      cy.getByCy("defense-import").should("be.visible");
    });
  });

  it("export and import buttons are hidden from a regular member", () => {
    let ownerData: UserSetupData;
    let allianceId: string;

    setupUser("def-perm-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "PermOwner", true);
    }).then((ownerAcc) => {
      return cy.apiCreateAlliance(ownerData.access_token, "PermAlliance", "PM", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("def-perm-member-token");
    }).then((member) => {
      return cy.apiCreateGameAccount(member.access_token, "PermMember", true).then((memberAcc) => {
        cy.apiInviteMember(ownerData.access_token, allianceId, memberAcc.id);
        cy.uiLogin(member.login);
        cy.navTo("alliances");
        cy.getByCy("accept-invitation").click();
        cy.contains("Invitation accepted").should("be.visible");
        cy.navTo("defense");
        cy.getByCy("defense-export").should("not.exist");
        cy.getByCy("defense-import").should("not.exist");
      });
    });
  });

  it("export and import buttons are visible to an officer", () => {
    let ownerData: UserSetupData;
    let allianceId: string;

    setupUser("def-officer-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "OfficerOwner", true);
    }).then((ownerAcc) => {
      return cy.apiCreateAlliance(ownerData.access_token, "OfficerAlliance", "OF", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("def-officer-token");
    }).then((officer) => {
      return cy.apiCreateGameAccount(officer.access_token, "OfficerAcc", true).then((officerAcc) => {
        cy.apiInviteMember(ownerData.access_token, allianceId, officerAcc.id);
        cy.uiLogin(officer.login);
        cy.navTo("alliances");
        cy.getByCy("accept-invitation").click();
        cy.contains("Invitation accepted").should("be.visible");
        cy.apiAddOfficer(ownerData.access_token, allianceId, officerAcc.id);
        cy.navTo("defense");
        cy.getByCy("defense-export").should("be.visible");
        cy.getByCy("defense-import").should("be.visible");
      });
    });
  });

  // =========================================================================
  // Champion placement: single player
  // =========================================================================

  it("shows defender count of 1/5 after placing one champion", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-place-admin-token").then((admin) => {
      adminData = admin;
      return setupUser("def-place-owner-token");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "PlaceOwner", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "PlaceAlliance", "PL", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champions) => {
      console.log(champions)
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champions[0].id, "7r5");
    }).then((championUser) => {
      cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, championUser.id, ownerAccId);
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");
      cy.getByCy("defender-count-PlaceOwner").should("contain", "1/5");
      cy.getByCy("member-section-PlaceOwner").find('[title*="Spider-Man"]').should("exist");
    });
  });

  it("counter increments correctly with multiple placements for one player", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-multi-admin-token").then((admin) => {
      adminData = admin;
      return setupUser("def-multi-owner-token");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "MultiOwner", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "MultiAlliance", "ML", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);

      cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic").then((champs) =>
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5").then((cu) =>
          cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
        )
      );
      cy.apiLoadChampion(adminData.access_token, "Wolverine", "Mutant").then((champs) =>
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5").then((cu) =>
          cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 2, cu.id, ownerAccId)
        )
      );
      cy.apiLoadChampion(adminData.access_token, "Iron Man", "Tech").then((champs) =>
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5").then((cu) =>
          cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 3, cu.id, ownerAccId)
        )
      );

      cy.uiLogin(ownerData.login);
      cy.navTo("defense");
      cy.getByCy("defender-count-MultiOwner").should("contain", "3/5");
    });
  });

  // =========================================================================
  // Multiple players: separate counters and sections
  // =========================================================================

  it("shows correct individual counters for two players in the same BG", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let memberData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;
    let memberAccId: string;

    setupAdmin("def-two-admin-token").then((admin) => {
      adminData = admin;
      return setupUser("def-two-owner-token");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "TwoOwner", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "TwoAlliance", "TW", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return setupUser("def-two-member-token");
    }).then((member) => {
      memberData = member;
      return cy.apiCreateGameAccount(member.access_token, "TwoMember", true);
    }).then((memberAcc) => {
      memberAccId = memberAcc.id;
      return cy.apiInviteMember(ownerData.access_token, allianceId, memberAccId);
    }).then(() => {
      // Accept invitation via member UI
      cy.uiLogin(memberData.login);
      cy.navTo("alliances");
      cy.getByCy("accept-invitation").click();
      cy.contains("Invitation accepted").should("be.visible");

      cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 1);

      cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic").then((champs) =>
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5").then((cu) =>
          cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
        )
      );
      cy.apiLoadChampion(adminData.access_token, "Wolverine", "Mutant").then((champs) =>
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, "7r5").then((cu) =>
          cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 2, cu.id, memberAccId)
        )
      );

      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("defender-count-TwoOwner").should("contain", "1/5");
      cy.getByCy("defender-count-TwoMember").should("contain", "1/5");
    });
  });

  it("defender appears in the correct player section (not the other player's)", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let memberData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;
    let memberAccId: string;

    setupAdmin("def-section-admin-token").then((admin) => {
      adminData = admin;
      return setupUser("def-section-owner-token");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "SectionOwner", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "SectionAlliance", "SC", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return setupUser("def-section-member-token");
    }).then((member) => {
      memberData = member;
      return cy.apiCreateGameAccount(member.access_token, "SectionMember", true);
    }).then((memberAcc) => {
      memberAccId = memberAcc.id;
      return cy.apiInviteMember(ownerData.access_token, allianceId, memberAccId);
    }).then(() => {
      cy.uiLogin(memberData.login);
      cy.navTo("alliances");
      cy.getByCy("accept-invitation").click();
      cy.contains("Invitation accepted").should("be.visible");

      cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 1);

      cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic").then((champs) =>
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5").then((cu) =>
          cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
        )
      );
      cy.apiLoadChampion(adminData.access_token, "Wolverine", "Mutant").then((champs) =>
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, "7r5").then((cu) =>
          cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 2, cu.id, memberAccId)
        )
      );

      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      // Spider-Man is owner's, Wolverine is member's — verify cross-isolation
      cy.getByCy("member-section-SectionOwner").find('[title*="Spider-Man"]').should("exist");
      cy.getByCy("member-section-SectionOwner").find('[title*="Wolverine"]').should("not.exist");
      cy.getByCy("member-section-SectionMember").find('[title*="Wolverine"]').should("exist");
      cy.getByCy("member-section-SectionMember").find('[title*="Spider-Man"]').should("not.exist");
    });
  });

  // =========================================================================
  // Remove defender: counter decrements
  // =========================================================================

  it("counter decrements after removing a defender", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-remove-admin-token").then((admin) => {
      adminData = admin;
      return setupUser("def-remove-owner-token");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "RemoveOwner", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "RemoveAlliance", "RM", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);

      cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic").then((champs) =>
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5").then((cu) =>
          cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
        )
      );
      cy.apiLoadChampion(adminData.access_token, "Wolverine", "Mutant").then((champs) =>
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5").then((cu) =>
          cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 2, cu.id, ownerAccId)
        )
      );

      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("defender-count-RemoveOwner").should("contain", "2/5");

      // Click remove on the first placed champion (button is CSS-hidden on hover, use force)
      cy.getByCy("member-section-RemoveOwner")
        .find("button")
        .first()
        .click({ force: true });

      cy.getByCy("defender-count-RemoveOwner").should("contain", "1/5");
    });
  });

  // =========================================================================
  // Clear All: all counters reset to zero
  // =========================================================================

  it("Clear All resets all defender counts to zero", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-clear-admin-token").then((admin) => {
      adminData = admin;
      return setupUser("def-clear-owner-token");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ClearOwner", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "ClearAlliance", "CL", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5");
    }).then((cu) => {
      cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId);

      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("defender-count-ClearOwner").should("contain", "1/5");

      cy.getByCy("defense-clear-all").click();
      cy.contains("button", "Confirm").click();

      cy.getByCy("defender-count-ClearOwner").should("contain", "0/5");
    });
  });

  // =========================================================================
  // Export: response contains expected fields
  // =========================================================================

  it("export returns JSON with champion_name, node_number and owner_name", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-export-admin-token").then((admin) => {
      adminData = admin;
      return setupUser("def-export-owner-token");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ExportOwner2", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "ExportAlliance2", "E2", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5");
    }).then((cu) => {
      cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId);

      cy.intercept("GET", `**/alliances/${allianceId}/defense/bg/1/export`).as("exportReq");

      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("defense-export").click();
      cy.wait("@exportReq").then((interception) => {
        expect(interception.response?.statusCode).to.eq(200);
        const body = interception.response?.body as Array<Record<string, unknown>>;
        expect(body).to.be.an("array").with.length(1);
        expect(body[0]).to.have.property("champion_name", "Spider-Man");
        expect(body[0]).to.have.property("node_number", 1);
        expect(body[0]).to.have.property("owner_name", "ExportOwner2");
      });
    });
  });

  // =========================================================================
  // Import round-trip: export → clear → import → restored state
  // =========================================================================

  it("import round-trip restores the placement correctly", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-import-admin-token").then((admin) => {
      adminData = admin;
      return setupUser("def-import-owner-token");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ImportOwner", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "ImportAlliance", "IM", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5");
    }).then((cu) => {
      cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId);

      // Export via API
      cy.request({
        method: "GET",
        url: `${BACKEND}/alliances/${allianceId}/defense/bg/1/export`,
        headers: { Authorization: `Bearer ${ownerData.access_token}` },
      }).then((exportRes) => {
        expect(exportRes.status).to.eq(200);
        const exportData = exportRes.body;

        // Clear via API
        cy.request({
          method: "DELETE",
          url: `http://localhost:8000/alliances/${allianceId}/defense/bg/1/clear`,
          headers: { Authorization: `Bearer ${ownerData.access_token}` },
        });

        // Import via API
        cy.request({
          method: "POST",
          url: `${BACKEND}/alliances/${allianceId}/defense/bg/1/import`,
          headers: { Authorization: `Bearer ${ownerData.access_token}` },
          body: { placements: exportData },
        }).then((importRes) => {
          expect(importRes.status).to.eq(200);
          expect(importRes.body.success_count).to.eq(1);
          expect(importRes.body.error_count).to.eq(0);
        });

        // Verify in UI: placement is restored
        cy.uiLogin(ownerData.login);
        cy.navTo("defense");
        cy.getByCy("defender-count-ImportOwner").should("contain", "1/5");
        cy.getByCy("member-section-ImportOwner").find('[title*="Spider-Man"]').should("exist");
      });
    });
  });
});
