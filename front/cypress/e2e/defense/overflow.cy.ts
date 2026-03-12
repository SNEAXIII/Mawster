import { setupUser, type UserSetupData, setupAdmin } from "../../support/e2e";

describe("Defense – Overflow & Error Cases", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // 6th champion: player with 5 already placed is disabled in owner picker
  // =========================================================================

  it("owner with 5/5 defenders is filtered out — 6th champion auto-places for the remaining member", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let memberData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;
    let memberAccId: string;

    setupAdmin("def-ov-full-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-ov-full-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "FullOwn", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "FullAll", "FL", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return setupUser("def-ov-full-member");
    }).then((member) => {
      memberData = member;
      return cy.apiCreateGameAccount(member.access_token, "FullMem", true);
    }).then((memberAcc) => {
      memberAccId = memberAcc.id;
      cy.apiForceJoinAlliance(memberAccId, allianceId);
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 1);

      const champNames = ["Spider-Man", "Wolverine", "Iron Man", "Doctor Doom", "Blade", "Hulk"];
      const champClasses = ["Cosmic", "Mutant", "Tech", "Mystic", "Skill", "Science"];

      // Load all 6 champions and add to owner's roster
      let chain = cy.wrap(null);
      const ownerCUs: string[] = [];
      for (let i = 0; i < 6; i++) {
        const name = champNames[i];
        const cls = champClasses[i];
        chain = chain.then(() => {
          return cy.apiLoadChampion(adminData.access_token, name, cls).then((champs) => {
            return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r3").then((cu) => {
              ownerCUs.push(cu.id);
              // Also add the same champion to memberAcc for the 6th one
              if (i === 5) {
                return cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, "7r3");
              }
            });
          });
        });
      }

      // Place 5 champions for owner via API
      chain.then(() => {
        for (let i = 0; i < 5; i++) {
          cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, i + 1, ownerCUs[i], ownerAccId);
        }

        cy.uiLogin(ownerData.login);
        cy.navTo("defense");

        // Verify counter shows 5/5
        cy.getByCy("defender-count-FullOwn").scrollIntoView().should("contain", "5/5");

        // Click an empty node — only Hulk should be available (first 5 already placed)
        cy.getByCy("war-node-10").scrollIntoView().click({ force: true });
        cy.contains("Select Champion").should("be.visible");

        // Click Hulk — owner (5/5) is filtered out by backend, so only member remains
        // With a single remaining owner the champion auto-places for the member
        cy.getByCy("champion-card-Hulk").click();
        cy.contains("Hulk placed on node #10").should("be.visible");

        // Member has 1/5
        cy.getByCy("defender-count-FullMem").scrollIntoView().should("contain", "1/5");
        // Owner still has 5/5
        cy.getByCy("defender-count-FullOwn").scrollIntoView().should("contain", "5/5");
      });
    });
  });

  it("counter turns red when player has 5/5 defenders", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-ov-red-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-ov-red-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "RedCntPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "RedCntAll", "RC", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);

      const champNames = ["Spider-Man", "Wolverine", "Iron Man", "Doctor Doom", "Blade"];
      const champClasses = ["Cosmic", "Mutant", "Tech", "Mystic", "Skill"];

      let chain = cy.wrap(null);
      for (let i = 0; i < 5; i++) {
        const name = champNames[i];
        const cls = champClasses[i];
        chain = chain.then(() => {
          return cy.apiLoadChampion(adminData.access_token, name, cls).then((champs) => {
            return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r3").then((cu) => {
              return cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, i + 1, cu.id, ownerAccId);
            });
          });
        });
      }

      chain.then(() => {
        cy.uiLogin(ownerData.login);
        cy.navTo("defense");

        // Counter should be red (text-red-400 CSS class)
        cy.getByCy("defender-count-RedCntPlyr")
          .should("contain", "5/5")
          .and("have.class", "text-red-400");
      });
    });
  });

  it("counter is NOT red when player has fewer than 5/5 defenders", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-ov-norm-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-ov-norm-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "NormCntPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "NormCntAll", "NC", ownerAcc.id);
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

      cy.getByCy("defender-count-NormCntPlyr")
        .should("contain", "1/5")
        .and("not.have.class", "text-red-400");
    });
  });

  // =========================================================================
  // Champion selector: no champions available
  // =========================================================================

  it("shows 'No champions available' when roster is empty", () => {
    setupUser("def-ov-empty-own-tok").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "EmptyRosterOwn", true).then((acc) => {
        cy.apiCreateAlliance(access_token, "EmptyRosterAll", "ER", acc.id).then((alliance) => {
          cy.apiSetMemberGroup(access_token, alliance.id, acc.id, 1);

          cy.uiLogin(login);
          cy.navTo("defense");

          cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
          cy.contains("No champions available").should("be.visible");
        });
      });
    });
  });

  it("shows 'No champions available' after all champions have been placed", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-ov-allplc-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-ov-allplc-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "AllPlcPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "AllPlcAll", "AP", ownerAcc.id);
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

      // Open selector for a different node — only champion is already placed
      cy.getByCy("war-node-2").scrollIntoView().click({ force: true });
      cy.contains("No champions available").should("be.visible");
    });
  });

  // =========================================================================
  // Owner picker: back button
  // =========================================================================

  it("back button in owner picker returns to champion grid", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let memberData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;
    let memberAccId: string;

    setupAdmin("def-ov-back-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-ov-back-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "BackOwn", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "BackAll", "BK", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return setupUser("def-ov-back-member");
    }).then((member) => {
      memberData = member;
      return cy.apiCreateGameAccount(member.access_token, "BackMem", true);
    }).then((memberAcc) => {
      memberAccId = memberAcc.id;
      cy.apiForceJoinAlliance(memberAccId, allianceId);
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 1);

      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r3");
      return cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, "7r4");
    }).then(() => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.contains("Select Champion").should("be.visible");
      cy.getByCy("champion-card-Spider-Man").click();
      cy.contains("Select Player").should("be.visible");

      // Click back button (← Back)
      cy.contains("button", "←").click();

      // Should be back on champion grid
      cy.contains("Select Champion").should("be.visible");
      cy.getByCy("champion-card-Spider-Man").should("be.visible");
    });
  });

  // =========================================================================
  // Selector dialog: closing without placing
  // =========================================================================

  it("closing the selector dialog without selecting does not place anything", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-ov-close-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-ov-close-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ClosePlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "CloseAll", "CL", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r3");
    }).then(() => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.contains("Select Champion").should("be.visible");

      // Close the dialog by pressing Escape
      cy.get("body").type("{esc}");
      cy.contains("Select Champion").should("not.exist");

      // Node should still be empty
      cy.getByCy("war-node-1").should("contain", "+");
      cy.getByCy("defender-count-ClosePlyr").should("contain", "0/5");
    });
  });

  // =========================================================================
  // Single owner: direct placement (no owner picker)
  // =========================================================================

  it("single-owner champion places directly without showing owner picker", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-ov-direct-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-ov-direct-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "DirectPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "DirectAll", "DR", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5", { signature: 200 });
    }).then(() => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Spider-Man").click();

      // Should directly place without showing "Select Player"
      cy.contains("Select Player").should("not.exist");
      cy.contains("Spider-Man placed on node #1").should("be.visible");
      cy.getByCy("defender-count-DirectPlyr").should("contain", "1/5");
    });
  });

  // =========================================================================
  // Champion selector: champion card shows owner count
  // =========================================================================

  it("champion card in selector shows owner count when multi-owner", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let memberData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;
    let memberAccId: string;

    setupAdmin("def-ov-cnt-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-ov-cnt-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "CntOwn", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "CntAll", "CN", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return setupUser("def-ov-cnt-member");
    }).then((member) => {
      memberData = member;
      return cy.apiCreateGameAccount(member.access_token, "CntMem", true);
    }).then((memberAcc) => {
      memberAccId = memberAcc.id;
      cy.apiForceJoinAlliance(memberAccId, allianceId);
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 1);

      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r3");
      return cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, "7r4");
    }).then(() => {
      return cy.apiLoadChampion(adminData.access_token, "Wolverine", "Mutant");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r3");
    }).then(() => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });

      // Spider-Man has 2 owners → shows "2 owners"
      cy.getByCy("champion-card-Spider-Man").should("contain", "2 owners");

      // Wolverine has 1 owner → shows pseudo and count
      cy.getByCy("champion-card-Wolverine").should("contain", "CntOwn");
      cy.getByCy("champion-card-Wolverine").should("contain", "0/5");
    });
  });
});
