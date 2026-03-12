import { setupUser, type UserSetupData } from "../../support/e2e";

describe("Defense – Basic page rendering", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it("shows no-alliance message when user has no alliances", () => {
    setupUser("def-basic-noally-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo("defense");
      cy.contains("need to join an alliance").should("be.visible");
    });
  });

  it("shows the defense page with alliance and BG selectors", () => {
    setupUser("def-basic-page-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "BasicPlayer", true).then((account) => {
        cy.apiCreateAlliance(access_token, "BasicAlliance", "BA", account.id);
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
    setupUser("def-basic-bg-token").then(({ login, access_token }) => {
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
    setupUser("def-basic-members-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "MembersPlayer", true).then((account) => {
        cy.apiCreateAlliance(access_token, "MembersAlliance", "MP", account.id);
      });

      cy.uiLogin(login);
      cy.navTo("defense");
      cy.contains("Members").should("be.visible");
    });
  });

  it("shows 50 war-map nodes on the page", () => {
    setupUser("def-basic-nodes-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "NodePlayer", true).then((account) => {
        cy.apiCreateAlliance(access_token, "NodeAlliance", "ND", account.id);
      });

      cy.uiLogin(login);
      cy.navTo("defense");

      // All 50 nodes should exist
      for (let i = 1; i <= 50; i++) {
        cy.getByCy(`war-node-${i}`).should("exist");
      }
    });
  });

  it("empty nodes show '+' placeholder", () => {
    setupUser("def-basic-empty-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "EmptyPlyr", true).then((account) => {
        cy.apiCreateAlliance(access_token, "EmptyAlliance", "EM", account.id);
      });

      cy.uiLogin(login);
      cy.navTo("defense");

      cy.getByCy("war-node-1").should("contain", "+");
      cy.getByCy("war-node-50").should("contain", "+");
    });
  });

  it("shows section labels (Boss, Mini Boss, Tier 2, Tier 1)", () => {
    setupUser("def-basic-sections-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "SectionPlyr", true).then((account) => {
        cy.apiCreateAlliance(access_token, "SectionAlliance", "SE", account.id);
      });

      cy.uiLogin(login);
      cy.navTo("defense");

      cy.contains("Boss").should("exist");
      cy.contains("Mini Boss").should("exist");
      cy.contains("Tier 2").should("exist");
      cy.contains("Tier 1").should("exist");
    });
  });

  it("shows 0/5 defender count when no champions placed", () => {
    setupUser("def-basic-nocount-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "EmptyCountPlyr", true).then((account) => {
        cy.apiCreateAlliance(access_token, "EmptyCountAll", "EC", account.id).then((alliance) => {
          cy.apiSetMemberGroup(access_token, alliance.id, account.id, 1);
        });
      });

      cy.uiLogin(login);
      cy.navTo("defense");

      cy.getByCy("defender-count-EmptyCountPlyr").should("contain", "0/5");
    });
  });

  it("shows 'No defenders placed.' when member has no placements", () => {
    let ownerData: UserSetupData;

    setupUser("def-basic-nodef-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "NoDefPlyr", true);
    }).then((account) => {
      return cy.apiCreateAlliance(ownerData.access_token, "NoDefAlliance", "NF", account.id).then((alliance) => {
        return cy.apiSetMemberGroup(ownerData.access_token, alliance.id, account.id, 1);
      });
    }).then(() => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");
      cy.contains("No defenders placed.").scrollIntoView().should("be.visible");
    });
  });

  it("member section shows member username", () => {
    let ownerData: UserSetupData;

    setupUser("def-basic-user-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "UserNamePlyr", true);
    }).then((account) => {
      return cy.apiCreateAlliance(ownerData.access_token, "UserNameAll", "UN", account.id).then((alliance) => {
        return cy.apiSetMemberGroup(ownerData.access_token, alliance.id, account.id, 1);
      });
    }).then(() => {
      cy.uiLogin(ownerData.login);
      cy.navTo("defense");
      cy.getByCy("member-section-UserNamePlyr").scrollIntoView().should("be.visible");
      cy.getByCy("member-section-UserNamePlyr").should("contain", "UserNamePlyr");
    });
  });

  it("two members in the same BG each have their own section", () => {
    let ownerData: UserSetupData;
    let allianceId: string;
    let ownerAccId: string;

    setupUser("def-basic-2m-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "TwoMemOwner", true);
    }).then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, "TwoMemAll", "TM", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      return setupUser("def-basic-2m-member-token");
    }).then((member) => {
      return cy.apiCreateGameAccount(member.access_token, "TwoMemMember", true).then((memberAcc) => {
        cy.apiForceJoinAlliance(memberAcc.id, allianceId);
        cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAcc.id, 1);

        cy.uiLogin(ownerData.login);
        cy.navTo("defense");

        cy.getByCy("member-section-TwoMemOwner").scrollIntoView().should("be.visible");
        cy.getByCy("member-section-TwoMemMember").scrollIntoView().should("be.visible");
      });
    });
  });
});
