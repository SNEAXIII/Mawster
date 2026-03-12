import { setupUser, type UserSetupData, setupAdmin, BACKEND } from "../../support/e2e";

describe("Defense – Operations (remove, clear, export, import)", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Remove defender via side panel
  // =========================================================================

  it("removes a defender from side panel and counter decrements", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-op-rm-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-op-rm-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "RmPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "RmAll", "RM", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);

      cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic").then((champs) =>
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5", { signature: 200 }).then((cu) =>
          cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
        )
      );
      cy.apiLoadChampion(adminData.access_token, "Wolverine", "Mutant").then((champs) =>
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r4", { signature: 100 }).then((cu) =>
          cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 2, cu.id, ownerAccId)
        )
      );

      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("defender-count-RmPlyr").should("contain", "2/5");

      // Click remove on the side panel (force click because button is hidden until hover)
      cy.getByCy("member-section-RmPlyr")
        .find("button")
        .first()
        .click({ force: true });

      cy.getByCy("defender-count-RmPlyr").should("contain", "1/5");
      cy.contains("Defender removed").should("be.visible");
    });
  });

  it("removes a defender from the war map red X button", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-op-rmmap-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-op-rmmap-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "RmMapPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "RmMapAll", "RX", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);

      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5", { signature: 200 });
    }).then((cu) => {
      cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 5, cu.id, ownerAccId);

      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("defender-count-RmMapPlyr").should("contain", "1/5");

      // Remove via the war map X button (force because hidden until hover)
      cy.getByCy("war-node-5")
        .find("button")
        .click({ force: true });

      cy.getByCy("defender-count-RmMapPlyr").should("contain", "0/5");
      cy.getByCy("war-node-5").should("contain", "+");
      cy.contains("Defender removed").should("be.visible");
    });
  });

  it("after removing a defender it reappears in the champion selector", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-op-rmreapp-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-op-rmreapp-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "RmReappPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "RmReappAll", "RR", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);

      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r3");
    }).then(() => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      // Place via UI
      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Spider-Man").click();
      cy.getByCy("defender-count-RmReappPlyr").should("contain", "1/5");

      // Spider-Man should NOT appear in selector for another node
      cy.getByCy("war-node-2").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Spider-Man").should("not.exist");
      cy.get("body").type("{esc}");

      // Remove Spider-Man via side panel
      cy.getByCy("member-section-RmReappPlyr")
        .find("button")
        .first()
        .click({ force: true });
      cy.getByCy("defender-count-RmReappPlyr").should("contain", "0/5");

      // Spider-Man should reappear in selector
      cy.getByCy("war-node-2").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Spider-Man").should("be.visible");
    });
  });

  // =========================================================================
  // Clear All
  // =========================================================================

  it("Clear All resets all defender counts to zero", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-op-clr-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-op-clr-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ClearPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "ClearAll", "CA", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);

      cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic").then((champs) =>
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5").then((cu) =>
          cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
        )
      );
      cy.apiLoadChampion(adminData.access_token, "Wolverine", "Mutant").then((champs) =>
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r4").then((cu) =>
          cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 2, cu.id, ownerAccId)
        )
      );

      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("defender-count-ClearPlyr").should("contain", "2/5");

      cy.getByCy("defense-clear-all").click();
      cy.contains("button", "Confirm").click();

      cy.getByCy("defender-count-ClearPlyr").should("contain", "0/5");
      cy.contains("Defense cleared").should("be.visible");
    });
  });

  it("Clear All empties all nodes on the war map", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-op-clrmap-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-op-clrmap-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ClrMapPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "ClrMapAll", "CM", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5");
    }).then((cu) => {
      cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 10, cu.id, ownerAccId);

      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      // Node 10 should be occupied
      cy.getByCy("war-node-10").should("contain", "ClrMapPlyr");

      cy.getByCy("defense-clear-all").click();
      cy.contains("button", "Confirm").click();

      // Node 10 should be empty
      cy.getByCy("war-node-10").should("contain", "+");
    });
  });

  it("Clear All shows 'No defenders placed.' in side panel", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-op-clrempty-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-op-clrempty-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ClrEmptyPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "ClrEmptyAll", "CE", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r3");
    }).then((cu) => {
      cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId);

      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("defense-clear-all").click();
      cy.contains("button", "Confirm").click();

      cy.contains("No defenders placed.").scrollIntoView().should("be.visible");
    });
  });

  it("Clear All confirmation dialog can be cancelled", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-op-clrcancel-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-op-clrcancel-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ClrCancelPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "ClrCancelAll", "CC", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r3");
    }).then((cu) => {
      cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId);

      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("defender-count-ClrCancelPlyr").should("contain", "1/5");

      cy.getByCy("defense-clear-all").click();
      // Dismiss without confirming (press Escape)
      cy.get("body").type("{esc}");

      // Defenders remain intact
      cy.getByCy("defender-count-ClrCancelPlyr").should("contain", "1/5");
    });
  });

  // =========================================================================
  // Export
  // =========================================================================

  it("export returns JSON with champion_name, node_number and owner_name", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-op-exp-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-op-exp-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ExportPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "ExportAll", "EP", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5", { signature: 200 });
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
        expect(body[0]).to.have.property("owner_name", "ExportPlyr");
        expect(body[0]).to.have.property("rarity", "7r5");
      });
    });
  });

  it("export shows warning toast when no defenders to export", () => {
    setupUser("def-op-exp-empty-tok").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "ExpEmptyPlyr", true).then((acc) => {
        cy.apiCreateAlliance(access_token, "ExpEmptyAll", "EE", acc.id);
      });

      cy.uiLogin(login);
      cy.navTo("defense");

      cy.getByCy("defense-export").click();
      cy.contains("No defenders to export").should("be.visible");
    });
  });

  it("export with multiple placements returns all champions", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-op-expmulti-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-op-expmulti-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ExpMultiPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "ExpMultiAll", "EM", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);

      cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic").then((champs) =>
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5").then((cu) =>
          cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
        )
      );
      cy.apiLoadChampion(adminData.access_token, "Wolverine", "Mutant").then((champs) =>
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r4").then((cu) =>
          cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 10, cu.id, ownerAccId)
        )
      );

      cy.intercept("GET", `**/alliances/${allianceId}/defense/bg/1/export`).as("exportMulti");

      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("defense-export").click();
      cy.wait("@exportMulti").then((interception) => {
        const body = interception.response?.body as Array<Record<string, unknown>>;
        expect(body).to.have.length(2);
        const names = body.map((b) => b.champion_name);
        expect(names).to.include("Spider-Man");
        expect(names).to.include("Wolverine");
        const nodes = body.map((b) => b.node_number);
        expect(nodes).to.include(1);
        expect(nodes).to.include(10);
      });
    });
  });

  // =========================================================================
  // Import round-trip
  // =========================================================================

  it("import round-trip restores the placement correctly", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-op-imp-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-op-imp-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ImportPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "ImportAll", "IM", ownerAcc.id);
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
          url: `${BACKEND}/alliances/${allianceId}/defense/bg/1/clear`,
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

        // Verify in UI
        cy.uiLogin(ownerData.login);
        cy.navTo("defense");
        cy.getByCy("defender-count-ImportPlyr").should("contain", "1/5");
        cy.getByCy("member-section-ImportPlyr").find('[title*="Spider-Man"]').should("exist");
      });
    });
  });

  it("import via UI file upload shows import report dialog", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-op-impui-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-op-impui-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ImpUIPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "ImpUIAll", "IU", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r3");
    }).then(() => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      // Prepare import JSON
      const importData = [
        {
          champion_name: "Spider-Man",
          rarity: "7r3",
          node_number: 1,
          owner_name: "ImpUIPlyr",
        },
      ];

      // Create a file and upload it
      const blob = new Blob([JSON.stringify(importData)], { type: "application/json" });
      const file = new File([blob], "defense_import.json", { type: "application/json" });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      cy.get('input[type="file"]').then((input) => {
        const el = input[0] as HTMLInputElement;
        el.files = dataTransfer.files;
        cy.wrap(input).trigger("change", { force: true });
      });

      // Import report dialog should appear
      cy.contains("Import Report").should("be.visible");

      // Verify placement restored
      cy.contains("Import Report").should("be.visible");
    });
  });

  it("import with unknown champion shows error in report", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-op-imperr-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-op-imperr-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ImpErrPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "ImpErrAll", "IE", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r3");
    }).then(() => {
      // Import via API with an unknown champion
      cy.request({
        method: "POST",
        url: `${BACKEND}/alliances/${allianceId}/defense/bg/1/import`,
        headers: { Authorization: `Bearer ${ownerData.access_token}` },
        body: {
          placements: [
            {
              champion_name: "Spider-Man",
              rarity: "7r3",
              node_number: 1,
              owner_name: "ImpErrPlyr",
            },
            {
              champion_name: "NonExistentHero",
              rarity: "7r3",
              node_number: 2,
              owner_name: "ImpErrPlyr",
            },
          ],
        },
      }).then((importRes) => {
        expect(importRes.status).to.eq(200);
        expect(importRes.body.success_count).to.eq(1);
        expect(importRes.body.error_count).to.eq(1);
        expect(importRes.body.errors[0].champion_name).to.eq("NonExistentHero");
        expect(importRes.body.errors[0].reason).to.include("Unknown champion");
      });

      // Verify only Spider-Man was placed
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");
      cy.getByCy("defender-count-ImpErrPlyr").should("contain", "1/5");
    });
  });

  it("import with unknown player shows error in report", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-op-impunk-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-op-impunk-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ImpUnkPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "ImpUnkAll", "IK", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r3");
    }).then(() => {
      cy.request({
        method: "POST",
        url: `${BACKEND}/alliances/${allianceId}/defense/bg/1/import`,
        headers: { Authorization: `Bearer ${ownerData.access_token}` },
        body: {
          placements: [
            {
              champion_name: "Spider-Man",
              rarity: "7r3",
              node_number: 1,
              owner_name: "GhostPlayer",
            },
          ],
        },
      }).then((importRes) => {
        expect(importRes.status).to.eq(200);
        expect(importRes.body.success_count).to.eq(0);
        expect(importRes.body.error_count).to.eq(1);
        expect(importRes.body.errors[0].reason).to.include("not found");
      });
    });
  });

  it("import clears previous defense before placing new ones", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-op-impclr-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-op-impclr-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ImpClrPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "ImpClrAll", "IC", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);

      cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic").then((champs) =>
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5").then((cu) =>
          cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
        )
      );

      return cy.apiLoadChampion(adminData.access_token, "Wolverine", "Mutant");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r4");
    }).then(() => {
      // Import different placement → previous gets cleared
      cy.request({
        method: "POST",
        url: `${BACKEND}/alliances/${allianceId}/defense/bg/1/import`,
        headers: { Authorization: `Bearer ${ownerData.access_token}` },
        body: {
          placements: [
            {
              champion_name: "Wolverine",
              rarity: "7r4",
              node_number: 10,
              owner_name: "ImpClrPlyr",
            },
          ],
        },
      }).then((importRes) => {
        expect(importRes.status).to.eq(200);
        expect(importRes.body.before).to.have.length(1);
        expect(importRes.body.before[0].champion_name).to.eq("Spider-Man");
        expect(importRes.body.after).to.have.length(1);
        expect(importRes.body.after[0].champion_name).to.eq("Wolverine");
      });

      // Verify in UI
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");
      cy.getByCy("defender-count-ImpClrPlyr").should("contain", "1/5");
      cy.getByCy("war-node-1").should("contain", "+"); // Spider-Man cleared
      cy.getByCy("war-node-10").should("contain", "ImpClrPlyr"); // Wolverine placed
    });
  });

  // =========================================================================
  // BG switching preserves no cross-contamination
  // =========================================================================

  it("defenders placed in BG1 are not visible in BG2", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-op-bgiso-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-op-bgiso-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "BGIsoPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "BGIsoAll", "BI", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r3");
    }).then((cu) => {
      cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId);

      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      // BG1: Spider-Man on node 1
      cy.getByCy("war-node-1").should("contain", "BGIsoPlyr");

      // Switch to BG2: node 1 should be empty
      cy.getByCy("defense-bg-2").click();
      cy.getByCy("war-node-1").should("contain", "+");

      // Switch back to BG1: Spider-Man still there
      cy.getByCy("defense-bg-1").click();
      cy.getByCy("war-node-1").should("contain", "BGIsoPlyr");
    });
  });
});
