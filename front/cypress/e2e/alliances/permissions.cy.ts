import { setupUser, type UserSetupData } from "../../support/e2e";

describe("Alliances – Permissions", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Regular member restrictions (using force-join instead of invite+accept)
  // =========================================================================

  it("regular member cannot see invite button", () => {
    let ownerData: UserSetupData;
    let allianceId: string;
    let memberLogin: string;

    setupUser("perm-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "PermOwner", true);
    }).then((ownerAccount) => {
      return cy.apiCreateAlliance(
        ownerData.access_token, "PermAlliance", "PA", ownerAccount.id
      );
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("perm-member-token");
    }).then((member) => {
      memberLogin = member.login;
      return cy.apiCreateGameAccount(member.access_token, "PermMember", true);
    }).then((memberAcc) => {
      // Force-join the game account to the alliance
      cy.apiForceJoinAlliance(memberAcc.id, allianceId);

      cy.uiLogin(memberLogin);
      cy.navTo("alliances");

      cy.getByCy("alliance-card-PermAlliance").should("be.visible").within(() => {
        cy.getByCy("invite-member-toggle").should("not.exist");
        cy.getByCy("member-row-PermMember").should("be.visible");
        cy.getByCy("member-row-PermOwner").should("be.visible");
      });
    });
  });

  it("regular member cannot see pending invitations section", () => {
    let ownerData: UserSetupData;
    let allianceId: string;
    let memberLogin: string;

    setupUser("perm-pending-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "PendingOwner", true);
    }).then((ownerAccount) => {
      return cy.apiCreateAlliance(
        ownerData.access_token, "PendingAlliance", "PD", ownerAccount.id
      );
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("perm-pending-member-token");
    }).then((member) => {
      memberLogin = member.login;
      return cy.apiCreateGameAccount(member.access_token, "PendingMember", true);
    }).then((memberAcc) => {
      // Force-join the game account
      cy.apiForceJoinAlliance(memberAcc.id, allianceId);

      // Create a third user and invite them (still pending)
      setupUser("perm-pending-third-token").then((third) => {
        cy.apiCreateGameAccount(third.access_token, "ThirdPlayer", true).then((thirdAccount) => {
          cy.apiInviteMember(ownerData.access_token, allianceId, thirdAccount.id);
        });
      });

      cy.uiLogin(memberLogin);
      cy.navTo("alliances");
      cy.getByCy("alliance-card-PendingAlliance").should("be.visible").within(() => {
        // Regular member should NOT see the pending invitations section
        cy.contains("Pending invitations").should("not.exist");
      });
    });
  });

  it("regular member cannot see promote/demote/exclude buttons", () => {
    let ownerData: UserSetupData;
    let allianceId: string;
    let memberLogin: string;

    setupUser("perm-no-actions-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ActionsOwner", true);
    }).then((ownerAccount) => {
      return cy.apiCreateAlliance(
        ownerData.access_token, "ActionsAlliance", "AC", ownerAccount.id
      );
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("perm-no-actions-member-token");
    }).then((member) => {
      memberLogin = member.login;
      return cy.apiCreateGameAccount(member.access_token, "ActionsMember", true);
    }).then((memberAcc) => {
      // Force-join the game account
      cy.apiForceJoinAlliance(memberAcc.id, allianceId);

      cy.uiLogin(memberLogin);
      cy.navTo("alliances");

      cy.getByCy("alliance-card-ActionsAlliance").should("be.visible").within(() => {
        cy.getByCy("promote-officer-ActionsOwner").should("not.exist");
        cy.getByCy("exclude-member-ActionsOwner").should("not.exist");
        cy.getByCy("member-group-select").should("not.exist");
      });
    });
  });

  // =========================================================================
  // Officer permissions
  // =========================================================================

  it("officer can see invite button but not promote button", () => {
    let ownerData: UserSetupData;
    let allianceId: string;
    let officerLogin: string;

    setupUser("perm-officer-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "OfficerOwner", true);
    }).then((ownerAccount) => {
      return cy.apiCreateAlliance(
        ownerData.access_token, "OfficerAlliance", "OF", ownerAccount.id
      );
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("perm-officer-member-token");
    }).then((officer) => {
      officerLogin = officer.login;
      return cy.apiCreateGameAccount(officer.access_token, "OfficerMember", true);
    }).then((officerAccount) => {
      // Force-join then promote to officer
      cy.apiForceJoinAlliance(officerAccount.id, allianceId);
      cy.apiAddOfficer(ownerData.access_token, allianceId, officerAccount.id);

      cy.uiLogin(officerLogin);
      cy.navTo("alliances");

      cy.getByCy("alliance-card-OfficerAlliance").should("be.visible").within(() => {
        cy.getByCy("invite-member-toggle").should("be.visible");
        cy.getByCy("promote-officer-OfficerOwner").should("not.exist");
        cy.getByCy("demote-officer-OfficerOwner").should("not.exist");
        cy.getByCy("member-group-select").should("exist");
      });
    });
  });
});
