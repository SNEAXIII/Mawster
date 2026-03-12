import { setupUser, type UserSetupData, setupAdmin } from "../../support/e2e";

describe("Defense – Permissions", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Export / Import button visibility
  // =========================================================================

  it("export and import buttons are visible to the alliance owner", () => {
    setupUser("def-perm-owner-tok").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "PermOwner", true).then((acc) => {
        cy.apiCreateAlliance(access_token, "PermOwnerAll", "PO", acc.id);
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

    setupUser("def-perm-own-hid-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "PermHidOwn", true);
    }).then((ownerAcc) => {
      return cy.apiCreateAlliance(ownerData.access_token, "PermHidAll", "PH", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("def-perm-member-hid-tok");
    }).then((member) => {
      return cy.apiCreateGameAccount(member.access_token, "PermHidMem", true).then((memberAcc) => {
        cy.apiForceJoinAlliance(memberAcc.id, allianceId);
        cy.uiLogin(member.login);
        cy.navTo("defense");
        cy.getByCy("defense-export").should("not.exist");
        cy.getByCy("defense-import").should("not.exist");
      });
    });
  });

  it("export and import buttons are visible to an officer", () => {
    let ownerData: UserSetupData;
    let allianceId: string;

    setupUser("def-perm-off-own-tok").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "PermOffOwn", true);
    }).then((ownerAcc) => {
      return cy.apiCreateAlliance(ownerData.access_token, "PermOffAll", "PF", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("def-perm-officer-tok");
    }).then((officer) => {
      return cy.apiCreateGameAccount(officer.access_token, "PermOfficer", true).then((officerAcc) => {
        cy.apiForceJoinAlliance(officerAcc.id, allianceId);
        cy.apiAddOfficer(ownerData.access_token, allianceId, officerAcc.id);
        cy.uiLogin(officer.login);
        cy.navTo("defense");
        cy.getByCy("defense-export").should("be.visible");
        cy.getByCy("defense-import").should("be.visible");
      });
    });
  });

  // =========================================================================
  // Clear All button visibility
  // =========================================================================

  it("clear all button is hidden when no defenders are placed", () => {
    setupUser("def-perm-clr-empty-tok").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "ClrEmptyOwn", true).then((acc) => {
        cy.apiCreateAlliance(access_token, "ClrEmptyAll", "CE", acc.id);
      });
      cy.uiLogin(login);
      cy.navTo("defense");
      cy.getByCy("defense-clear-all").should("not.exist");
    });
  });

  it("clear all button is visible when defenders are placed (owner)", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-perm-clr-adm-tok").then((admin) => {
      adminData = admin;
      return setupUser("def-perm-clr-own-tok");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ClrOwnPlyr", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "ClrOwnAll", "CO", ownerAcc.id);
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
      cy.getByCy("defense-clear-all").should("be.visible");
    });
  });

  it("clear all button is hidden from a regular member even with placements", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let memberData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;
    let memberAccId: string;

    setupAdmin("def-perm-clr-mem-adm").then((admin) => {
      adminData = admin;
      return setupUser("def-perm-clr-mem-own");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ClrMemOwn", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "ClrMemAll", "CM", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return setupUser("def-perm-clr-mem-tok");
    }).then((member) => {
      memberData = member;
      return cy.apiCreateGameAccount(member.access_token, "ClrMember", true);
    }).then((memberAcc) => {
      memberAccId = memberAcc.id;
      cy.apiForceJoinAlliance(memberAccId, allianceId);
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 1);

      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r3");
    }).then((cu) => {
      cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId);

      cy.uiLogin(memberData.login);
      cy.navTo("defense");
      cy.getByCy("defense-clear-all").should("not.exist");
    });
  });

  // =========================================================================
  // Clicking empty node: member vs. owner/officer
  // =========================================================================

  it("clicking an empty node does NOT open champion selector for a regular member", () => {
    let ownerData: UserSetupData;
    let allianceId: string;

    setupUser("def-perm-click-own-tok").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ClickOwn", true);
    }).then((ownerAcc) => {
      return cy.apiCreateAlliance(ownerData.access_token, "ClickAll", "CK", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("def-perm-click-mem-tok");
    }).then((member) => {
      return cy.apiCreateGameAccount(member.access_token, "ClickMem", true).then((memberAcc) => {
        cy.apiForceJoinAlliance(memberAcc.id, allianceId);
        cy.uiLogin(member.login);
        cy.navTo("defense");

        cy.getByCy("war-node-1").scrollIntoView().click({ force: true });
        // Selector dialog should NOT appear
        cy.contains("Select Champion").should("not.exist");
      });
    });
  });

  it("clicking an empty node opens champion selector for the owner", () => {
    let adminData: UserSetupData;
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupAdmin("def-perm-click-adm-tok").then((admin) => {
      adminData = admin;
      return setupUser("def-perm-click-own2-tok");
    }).then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ClickOwn2", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "ClickAll2", "C2", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);

      // Load a champion so the selector won't be empty
      return cy.apiLoadChampion(adminData.access_token, "Spider-Man", "Cosmic");
    }).then((champs) => {
      return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r3");
    }).then(() => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");

      cy.getByCy("war-node-5").click();
      cy.contains("Select Champion").should("be.visible");
      cy.contains("Node #5").should("be.visible");
    });
  });
});
