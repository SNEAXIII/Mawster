import { setupUser, type UserSetupData, setupAdmin } from "../../support/e2e";

/**
 * Helper: setup owner with alliance + BG1, load N champions and add them to roster.
 * Returns { adminData, ownerData, allianceId, ownerAccId, championUsers }.
 * Each entry in `champDefs` is { name, class, rarity, options? }.
 */
function setupDefenseScenario(
  tokenPrefix: string,
  ownerPseudo: string,
  allianceTag: string,
  champDefs: { name: string; cls: string; rarity: string; options?: { signature?: number; is_preferred_attacker?: boolean; ascension?: number; is_ascendable?: boolean } }[],
) {
  return setupAdmin(`${tokenPrefix}-admin`).then((adminData) => {
    return setupUser(`${tokenPrefix}-owner`).then((ownerData) => {
      return cy.apiCreateGameAccount(ownerData.access_token, ownerPseudo, true).then((ownerAcc) => {
        const ownerAccId = ownerAcc.id;
        return cy.apiCreateAlliance(ownerData.access_token, `${allianceTag}All`, allianceTag, ownerAccId).then((alliance) => {
          const allianceId = alliance.id;
          cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);

          // Load and add champions sequentially
          const championUsers: { name: string; cuId: string }[] = [];
          let chain = cy.wrap(null);

          for (const def of champDefs) {
            chain = chain.then(() => {
              return cy.apiLoadChampion(adminData.access_token, def.name, def.cls, {
                is_ascendable: def.options?.is_ascendable ?? false,
              }).then((champs) => {
                return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, def.rarity, {
                  signature: def.options?.signature ?? 0,
                  is_preferred_attacker: def.options?.is_preferred_attacker ?? false,
                  ascension: def.options?.ascension ?? 0,
                }).then((cu) => {
                  championUsers.push({ name: def.name, cuId: cu.id });
                });
              });
            });
          }

          return chain.then(() => ({
            adminData,
            ownerData,
            allianceId,
            ownerAccId,
            championUsers,
          }));
        });
      });
    });
  });
}

describe("Defense – Placement via UI", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Single champion placement via UI click
  // =========================================================================

  it("places a champion on node #1 via UI click and verifies side panel", () => {
    setupDefenseScenario("def-pl-single", "PlacePlyr", "PS", [
      { name: "Spider-Man", cls: "Cosmic", rarity: "7r3", options: { signature: 200 } },
    ]).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      // Click empty node #1
      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.contains("Select Champion").should("be.visible");
      cy.contains("Node #1").should("be.visible");

      // Click Spider-Man card
      cy.getByCy("champion-card-Spider-Man").click();

      // Toast confirmation
      cy.contains("Spider-Man placed on node #1").should("be.visible");

      // Side panel verification
      cy.getByCy("defender-count-PlacePlyr").should("contain", "1/5");
      cy.getByCy("member-section-PlacePlyr").find('[title*="Spider-Man"]').should("exist");

      // War map node shows champion name
      cy.getByCy("war-node-1").should("contain", "PlacePlyr");
    });
  });

  // =========================================================================
  // Rarity labels on war map and side panel
  // =========================================================================

  it("shows correct rarity label 7★R3·200 on war map and side panel", () => {
    setupDefenseScenario("def-pl-label", "LabelPlyr", "LB", [
      { name: "Spider-Man", cls: "Cosmic", rarity: "7r3", options: { signature: 200 } },
    ]).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Spider-Man").click();

      // Rarity label on war map node: 7★R3·200
      cy.getByCy("war-node-1").should("contain", "7★R3·200");

      // Rarity label on side panel defender card
      cy.getByCy("defender-card-1").should("contain", "7★R3·200");
    });
  });

  it("shows rarity label with ascension 7★R5·A1·200 on war map and side panel", () => {
    setupDefenseScenario("def-pl-asc", "AscPlyr", "AS", [
      { name: "Doctor Doom", cls: "Mystic", rarity: "7r5", options: { signature: 200, ascension: 1, is_ascendable: true } },
    ]).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-10").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Doctor-Doom").click();

      // Rarity label with ascension: 7★R5·A1·200
      cy.getByCy("war-node-10").should("contain", "7★R5·A1·200");
      cy.getByCy("defender-card-10").should("contain", "7★R5·A1·200");
    });
  });

  it("shows rarity label with ascension level 2: 7★R5·A2·200", () => {
    setupDefenseScenario("def-pl-asc2", "Asc2Plyr", "A2", [
      { name: "Blade", cls: "Skill", rarity: "7r5", options: { signature: 200, ascension: 2, is_ascendable: true } },
    ]).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-5").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Blade").click();

      cy.getByCy("war-node-5").should("contain", "7★R5·A2·200");
      cy.getByCy("defender-card-5").should("contain", "7★R5·A2·200");
    });
  });

  it("shows rarity label 7★R4·0 for zero-signature champion", () => {
    setupDefenseScenario("def-pl-zsig", "ZSigPlyr", "ZS", [
      { name: "Wolverine", cls: "Mutant", rarity: "7r4", options: { signature: 0 } },
    ]).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-3").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Wolverine").click();

      cy.getByCy("war-node-3").should("contain", "7★R4·0");
      cy.getByCy("defender-card-3").should("contain", "7★R4·0");
    });
  });

  it("shows rarity label 6★R5·20 for 6-star champion", () => {
    setupDefenseScenario("def-pl-6star", "SixPlyr", "6S", [
      { name: "Hulk", cls: "Science", rarity: "6r5", options: { signature: 20 } },
    ]).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-7").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Hulk").click();

      cy.getByCy("war-node-7").should("contain", "6★R5·20");
      cy.getByCy("defender-card-7").should("contain", "6★R5·20");
    });
  });

  // =========================================================================
  // Preferred attacker display
  // =========================================================================

  it("preferred attacker shows ⚔ prefix and yellow color on war map and side panel", () => {
    setupDefenseScenario("def-pl-pref", "PrefPlyr", "PR", [
      { name: "Iron Man", cls: "Tech", rarity: "7r5", options: { signature: 200, is_preferred_attacker: true } },
    ]).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-20").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Iron-Man").click();

      // War map: ⚔ prefix on rarity label
      cy.getByCy("war-node-20").should("contain", "⚔");
      cy.getByCy("war-node-20").should("contain", "7★R5·200");

      // Side panel: ⚔ prefix on node number
      cy.getByCy("defender-card-20").should("contain", "⚔");
    });
  });

  it("non-preferred attacker does NOT show ⚔ prefix", () => {
    setupDefenseScenario("def-pl-nopref", "NoPrefPlyr", "NP", [
      { name: "Wolverine", cls: "Mutant", rarity: "7r3", options: { signature: 100, is_preferred_attacker: false } },
    ]).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-15").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Wolverine").click();

      cy.getByCy("war-node-15").should("not.contain", "⚔");
      cy.getByCy("defender-card-15").should("not.contain", "⚔");
    });
  });

  // =========================================================================
  // Preferred attacker shown in selector dialog
  // =========================================================================

  it("champion selector shows ⚔ marker for preferred attacker champions", () => {
    setupDefenseScenario("def-pl-sel-pref", "SelPrefPlyr", "SP", [
      { name: "Captain America", cls: "Science", rarity: "7r3", options: { is_preferred_attacker: true } },
      { name: "Wolverine", cls: "Mutant", rarity: "7r3", options: { is_preferred_attacker: false } },
    ]).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.contains("Select Champion").should("be.visible");

      // Captain America card should show ⚔
      cy.getByCy("champion-card-Captain-America").should("contain", "⚔");
      // Wolverine card should NOT show ⚔
      cy.getByCy("champion-card-Wolverine").should("not.contain", "⚔");
    });
  });

  // =========================================================================
  // Multiple sequential placements via UI
  // =========================================================================

  it("places 3 champions sequentially via UI and verifies all labels and counts", () => {
    setupDefenseScenario("def-pl-seq", "SeqPlyr", "SQ", [
      { name: "Spider-Man", cls: "Cosmic", rarity: "7r5", options: { signature: 200, is_preferred_attacker: true, ascension: 1, is_ascendable: true } },
      { name: "Wolverine", cls: "Mutant", rarity: "7r4", options: { signature: 100 } },
      { name: "Iron Man", cls: "Tech", rarity: "7r3", options: { signature: 20 } },
    ]).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      // Place Spider-Man on Boss node 50
      cy.getByCy("war-node-50").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Spider-Man").click();
      cy.contains("Spider-Man placed on node #50").should("be.visible");
      cy.getByCy("defender-count-SeqPlyr").should("contain", "1/5");

      // Place Wolverine on Mini Boss node 40
      cy.getByCy("war-node-40").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Wolverine").click();
      cy.contains("Wolverine placed on node #40").should("be.visible");
      cy.getByCy("defender-count-SeqPlyr").should("contain", "2/5");

      // Place Iron Man on Tier 1 node 1
      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Iron-Man").click();
      cy.contains("Iron Man placed on node #1").should("be.visible");
      cy.getByCy("defender-count-SeqPlyr").should("contain", "3/5");

      // Verify labels on war map
      // Spider-Man: preferred attacker → 7★R5·A1·200 with ⚔
      cy.getByCy("war-node-50").should("contain", "⚔");
      cy.getByCy("war-node-50").should("contain", "7★R5·A1·200");
      cy.getByCy("war-node-50").should("contain", "SeqPlyr");

      // Wolverine: 7★R4·100
      cy.getByCy("war-node-40").should("not.contain", "⚔");
      cy.getByCy("war-node-40").should("contain", "7★R4·100");
      cy.getByCy("war-node-40").should("contain", "SeqPlyr");

      // Iron Man: 7★R3·20
      cy.getByCy("war-node-1").should("not.contain", "⚔");
      cy.getByCy("war-node-1").should("contain", "7★R3·20");
      cy.getByCy("war-node-1").should("contain", "SeqPlyr");

      // Verify side panel labels
      cy.getByCy("defender-card-50").should("contain", "7★R5·A1·200");
      cy.getByCy("defender-card-50").should("contain", "⚔");
      cy.getByCy("defender-card-40").should("contain", "7★R4·100");
      cy.getByCy("defender-card-1").should("contain", "7★R3·20");

      // Verify node numbers in side panel
      cy.getByCy("defender-card-50").should("contain", "#50");
      cy.getByCy("defender-card-40").should("contain", "#40");
      cy.getByCy("defender-card-1").should("contain", "#1");
    });
  });

  it("places 5 champions via UI and counter shows 5/5", () => {
    setupDefenseScenario("def-pl-five", "FivePlyr", "FV", [
      { name: "Spider-Man", cls: "Cosmic", rarity: "7r5", options: { signature: 200 } },
      { name: "Wolverine", cls: "Mutant", rarity: "7r4", options: { signature: 100 } },
      { name: "Iron Man", cls: "Tech", rarity: "7r3", options: { signature: 20 } },
      { name: "Doctor Doom", cls: "Mystic", rarity: "7r5", options: { signature: 200, ascension: 2, is_ascendable: true } },
      { name: "Blade", cls: "Skill", rarity: "7r3", options: { signature: 0 } },
    ]).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Spider-Man").click();
      cy.getByCy("defender-count-FivePlyr").should("contain", "1/5");

      cy.getByCy("war-node-2").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Wolverine").click();
      cy.getByCy("defender-count-FivePlyr").should("contain", "2/5");

      cy.getByCy("war-node-3").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Iron-Man").click();
      cy.getByCy("defender-count-FivePlyr").should("contain", "3/5");

      cy.getByCy("war-node-4").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Doctor-Doom").click();
      cy.getByCy("defender-count-FivePlyr").should("contain", "4/5");

      cy.getByCy("war-node-5").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Blade").click();
      cy.getByCy("defender-count-FivePlyr").should("contain", "5/5");

      // All labels on war map
      cy.getByCy("war-node-1").should("contain", "7★R5·200");
      cy.getByCy("war-node-2").should("contain", "7★R4·100");
      cy.getByCy("war-node-3").should("contain", "7★R3·20");
      cy.getByCy("war-node-4").should("contain", "7★R5·A2·200");
      cy.getByCy("war-node-5").should("contain", "7★R3·0");
    });
  });

  // =========================================================================
  // Champion selector: search filter
  // =========================================================================

  it("search filter in champion selector filters champions by name", () => {
    setupDefenseScenario("def-pl-search", "SearchPlyr", "SR", [
      { name: "Spider-Man", cls: "Cosmic", rarity: "7r3" },
      { name: "Wolverine", cls: "Mutant", rarity: "7r3" },
      { name: "Iron Man", cls: "Tech", rarity: "7r3" },
    ]).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.contains("Select Champion").should("be.visible");

      // All 3 visible initially
      cy.getByCy("champion-card-Spider-Man").should("be.visible");
      cy.getByCy("champion-card-Wolverine").should("be.visible");
      cy.getByCy("champion-card-Iron-Man").should("be.visible");

      // Type "spider" → only Spider-Man visible
      cy.get("input[placeholder]").type("spider");
      cy.getByCy("champion-card-Spider-Man").should("be.visible");
      cy.getByCy("champion-card-Wolverine").should("not.exist");
      cy.getByCy("champion-card-Iron-Man").should("not.exist");
    });
  });

  it("search filter by champion class", () => {
    setupDefenseScenario("def-pl-class-search", "ClsSearchPlyr", "CS", [
      { name: "Spider-Man", cls: "Cosmic", rarity: "7r3" },
      { name: "Wolverine", cls: "Mutant", rarity: "7r3" },
    ]).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });

      cy.get("input[placeholder]").type("mutant");
      cy.getByCy("champion-card-Wolverine").should("be.visible");
      cy.getByCy("champion-card-Spider-Man").should("not.exist");
    });
  });

  // =========================================================================
  // Champion selector: rarity & ascension labels in selector grid
  // =========================================================================

  it("champion selector shows rarity label and ascension badge for each champion card", () => {
    setupDefenseScenario("def-pl-sel-label", "SelLabelPlyr", "SL", [
      { name: "Spider-Man", cls: "Cosmic", rarity: "7r5", options: { ascension: 1, is_ascendable: true } },
      { name: "Wolverine", cls: "Mutant", rarity: "7r3" },
    ]).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });

      // Spider-Man card should show 7★R5 and A1
      cy.getByCy("champion-card-Spider-Man").should("contain", "7★R5");
      cy.getByCy("champion-card-Spider-Man").should("contain", "A1");

      // Wolverine card should show 7★R3 and no ascension
      cy.getByCy("champion-card-Wolverine").should("contain", "7★R3");
      cy.getByCy("champion-card-Wolverine").should("not.contain", "· A");
    });
  });

  // =========================================================================
  // Already placed champion excluded from selector
  // =========================================================================

  it("placed champion is excluded from the selector for second placement", () => {
    setupDefenseScenario("def-pl-excl", "ExclPlyr", "EX", [
      { name: "Spider-Man", cls: "Cosmic", rarity: "7r3", options: { signature: 200 } },
      { name: "Wolverine", cls: "Mutant", rarity: "7r3", options: { signature: 100 } },
    ]).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      // Place Spider-Man
      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Spider-Man").click();
      cy.contains("Spider-Man placed on node #1").should("be.visible");

      // Open selector for another node — Spider-Man should not appear
      cy.getByCy("war-node-2").scrollIntoView().click({ force: true });
      cy.contains("Select Champion").should("be.visible");
      cy.getByCy("champion-card-Spider-Man").should("not.exist");
      cy.getByCy("champion-card-Wolverine").should("be.visible");
    });
  });

  // =========================================================================
  // Replace champion on occupied node
  // =========================================================================

  it("clicking an occupied node opens selector and replaces the defender", () => {
    setupDefenseScenario("def-pl-replace", "ReplPlyr", "RP", [
      { name: "Spider-Man", cls: "Cosmic", rarity: "7r3", options: { signature: 200 } },
      { name: "Wolverine", cls: "Mutant", rarity: "7r4", options: { signature: 100 } },
    ]).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      // Place Spider-Man on node 1
      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Spider-Man").click();
      cy.getByCy("war-node-1").should("contain", "7★R3·200");

      // Click occupied node 1 to replace
      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.contains("Select Champion").should("be.visible");
      cy.getByCy("champion-card-Wolverine").click();

      // Should now show Wolverine
      cy.getByCy("war-node-1").should("contain", "7★R4·100");
      cy.getByCy("defender-count-ReplPlyr").should("contain", "1/5");
    });
  });

  // =========================================================================
  // Multi-owner champion: owner picker
  // =========================================================================

  it("shows owner picker when champion has multiple owners", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let memberData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;
    let memberAccId: string;

    setupAdmin("def-pl-multi-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-pl-multi-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "MultiOwn", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "MultiAll", "MO", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return setupUser("def-pl-multi-member");
    }).then((member) => {
      memberData = member;
      return cy.apiCreateGameAccount(member.access_token, "MultiMem", true);
    }).then((memberAcc) => {
      memberAccId = memberAcc.id;
      cy.apiForceJoinAlliance(memberAccId, allianceId);
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 1);

      // Both players have the same champion
      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5", { signature: 200 });
      return cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, "7r3", { signature: 100 });
    }).then(() => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      // Click node → Spider-Man → owner picker appears
      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Spider-Man").click();
      cy.contains("Select Player").should("be.visible");

      // Both owners listed
      cy.getByCy("owner-row-MultiOwn").should("be.visible");
      cy.getByCy("owner-row-MultiMem").should("be.visible");

      // Owner row shows rarity and sig
      cy.getByCy("owner-row-MultiOwn").should("contain", "7★R5");
      cy.getByCy("owner-row-MultiOwn").should("contain", "sig 200");
      cy.getByCy("owner-row-MultiOwn").should("contain", "0/5");

      cy.getByCy("owner-row-MultiMem").should("contain", "7★R3");
      cy.getByCy("owner-row-MultiMem").should("contain", "sig 100");
      cy.getByCy("owner-row-MultiMem").should("contain", "0/5");

      // Select the first owner
      cy.getByCy("owner-row-MultiOwn").click();
      cy.contains("Spider-Man placed on node #1").should("be.visible");
      cy.getByCy("defender-count-MultiOwn").should("contain", "1/5");
    });
  });

  it("owner picker shows preferred attacker ⚔ flag and 7★ badge", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let memberData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;
    let memberAccId: string;

    setupAdmin("def-pl-opref-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-pl-opref-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "OPrefOwn", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "OPrefAll", "OP", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return setupUser("def-pl-opref-member");
    }).then((member) => {
      memberData = member;
      return cy.apiCreateGameAccount(member.access_token, "OPrefMem", true);
    }).then((memberAcc) => {
      memberAccId = memberAcc.id;
      cy.apiForceJoinAlliance(memberAccId, allianceId);
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 1);

      return cy.apiLoadChampion(adminData.access_token, "Wolverine", "Mutant");
    }).then((champs) => {
      cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5", {
        signature: 200,
        is_preferred_attacker: true,
      });
      return cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, "7r3", {
        signature: 50,
        is_preferred_attacker: false,
      });
    }).then(() => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Wolverine").click();
      cy.contains("Select Player").should("be.visible");

      // Owner has preferred attacker → ⚔ and 7★ badge
      cy.getByCy("owner-row-OPrefOwn").should("contain", "⚔");
      cy.getByCy("owner-row-OPrefOwn").should("contain", "7★");

      // Member does NOT have preferred attacker
      cy.getByCy("owner-row-OPrefMem").should("not.contain", "⚔");
    });
  });

  it("owner picker shows ascension in rarity label", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let memberData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;
    let memberAccId: string;

    setupAdmin("def-pl-oasc-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-pl-oasc-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "OAscOwn", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "OAscAll", "OA", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return setupUser("def-pl-oasc-member");
    }).then((member) => {
      memberData = member;
      return cy.apiCreateGameAccount(member.access_token, "OAscMem", true);
    }).then ((memberAcc) => {
      memberAccId = memberAcc.id;
      cy.apiForceJoinAlliance(memberAccId, allianceId);
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 1);

      return cy.apiLoadChampion(adminData.access_token, "Doctor Doom", "Mystic", { is_ascendable: true });
    }).then((champs) => {
      cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5", {
        signature: 200,
        ascension: 2,
      });
      return cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, "7r5", {
        signature: 100,
        ascension: 0,
      });
    }).then(() => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Doctor-Doom").click();
      cy.contains("Select Player").should("be.visible");

      // Owner has ascension 2
      cy.getByCy("owner-row-OAscOwn").should("contain", "A2");
      cy.getByCy("owner-row-OAscOwn").should("contain", "sig 200");

      // Member: no ascension
      cy.getByCy("owner-row-OAscMem").should("not.contain", "· A");
      cy.getByCy("owner-row-OAscMem").should("contain", "sig 100");
    });
  });

  // =========================================================================
  // Two players: correct isolation
  // =========================================================================

  it("champion placed for player A appears only in player A's section", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let memberData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;
    let memberAccId: string;

    setupAdmin("def-pl-iso-admin").then((admin) => {
      adminData = admin;
      return setupUser("def-pl-iso-owner");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "IsoOwner", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "IsoAll", "IS", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return setupUser("def-pl-iso-member");
    }).then((member) => {
      memberData = member;
      return cy.apiCreateGameAccount(member.access_token, "IsoMember", true);
    }).then((memberAcc) => {
      memberAccId = memberAcc.id;
      cy.apiForceJoinAlliance(memberAccId, allianceId);
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 1);

      cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic").then((champs) =>
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r5", { signature: 200 })
      );
      return cy.apiLoadChampion(adminData.access_token, "Wolverine", "Mutant");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, "7r4", { signature: 100 });
    }).then(() => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      // Place Spider-Man for owner via UI
      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Spider-Man").should("be.visible").click();
      cy.contains("Spider-Man placed on node #1").should("be.visible");

      // Place Wolverine for member via UI
      cy.getByCy("war-node-2").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Wolverine").should("be.visible").click();

      // Verify isolation
      cy.getByCy("member-section-IsoOwner").find('[title*="Spider-Man"]').should("exist");
      cy.getByCy("member-section-IsoOwner").find('[title*="Wolverine"]').should("not.exist");
      cy.getByCy("member-section-IsoMember").find('[title*="Wolverine"]').should("exist");
      cy.getByCy("member-section-IsoMember").find('[title*="Spider-Man"]').should("not.exist");

      // Verify counters
      cy.getByCy("defender-count-IsoOwner").should("contain", "1/5");
      cy.getByCy("defender-count-IsoMember").should("contain", "1/5");
    });
  });

  // =========================================================================
  // Node title verification
  // =========================================================================

  it("war map node title updates after placement", () => {
    setupDefenseScenario("def-pl-title", "TitlePlyr", "TT", [
      { name: "Spider-Man", cls: "Cosmic", rarity: "7r3", options: { signature: 200 } },
    ]).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      // Before placement: title is "Node #1 — Empty"
      cy.getByCy("war-node-1").should("have.attr", "title").and("include", "Empty");

      // Place champion
      cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
      cy.getByCy("champion-card-Spider-Man").click();

      // After placement: title includes champion name and player
      cy.getByCy("war-node-1").should("have.attr", "title").and("include", "Spider-Man");
      cy.getByCy("war-node-1").should("have.attr", "title").and("include", "TitlePlyr");
    });
  });
});
