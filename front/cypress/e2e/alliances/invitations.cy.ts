import { BACKEND, setupUser, type UserSetupData } from "../../support/e2e";

describe("Alliances – Invitations", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it("invites a member and verifies pending invitation content", () => {
    let ownerData: UserSetupData;

    setupUser("alliance-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "OwnerAcc", true);
    }).then((ownerAccount) => {
      return cy.apiCreateAlliance(
        ownerData.access_token,
        "InviteAlliance",
        "IA",
        ownerAccount.id
      );
    }).then(() => {
      return setupUser("alliance-newmember-token");
    }).then((newMember) => {
      return cy.apiCreateGameAccount(newMember.access_token, "NewMemberAcc", true);
    }).then(() => {
      cy.uiLogin(ownerData.login);
      cy.navTo("alliances");

      cy.getByCy("alliance-card-InviteAlliance").should("be.visible");

      cy.intercept("GET", "**/alliances/eligible-members").as("eligibleMembers");
      cy.getByCy("invite-member-toggle").click();
      cy.wait("@eligibleMembers");

      cy.getByCy("invite-member-select").click();
      cy.contains("[role='option']", "NewMemberAcc", { timeout: 1000 }).click();

      cy.getByCy("invite-member-submit").click({ timeout: 1000 });
      cy.contains("Invitation sent successfully").should("be.visible");

      // Verify pending invitation content
      cy.contains("Pending invitations (1)").should("be.visible");
      cy.getByCy("pending-invitation-0").should("contain", "NewMemberAcc");
      cy.getByCy("pending-invitation-0").should("contain", "Invited by OwnerAcc");
    });
  });

  it("accepts an invitation via the UI and verifies alliance content", () => {
    let ownerData: UserSetupData;
    let allianceId: string;
    let inviteeLogin: string;

    setupUser("alliance-accept-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "AccOwner", true);
    }).then((ownerAccount) => {
      return cy.apiCreateAlliance(
        ownerData.access_token, "JoinAlliance", "JA", ownerAccount.id
      );
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("alliance-accept-invitee-token");
    }).then((invitee) => {
      inviteeLogin = invitee.login;
      return cy.apiCreateGameAccount(invitee.access_token, "JoinPlayer", true);
    }).then((inviteeAccount) => {
      cy.apiInviteMember(ownerData.access_token, allianceId, inviteeAccount.id);

      cy.uiLogin(inviteeLogin);
      cy.navTo("alliances");

      // Verify invitation content before accepting
      cy.getByCy("my-invitations-section").should("be.visible");
      cy.getByCy("my-invitation-JoinAlliance").should("contain", "JoinAlliance");
      cy.getByCy("my-invitation-JoinAlliance").should("contain", "[JA]");
      cy.getByCy("my-invitation-JoinAlliance").should("contain", "JoinPlayer");

      cy.getByCy("accept-invitation").click();
      cy.contains("Invitation accepted").should("be.visible");

      // After accepting, alliance card appears with correct member count
      cy.getByCy("alliance-card-JoinAlliance").should("be.visible").within(() => {
        cy.getByCy("alliance-member-count").should("contain", "2");
        cy.getByCy("member-row-JoinPlayer").should("be.visible");
        cy.getByCy("member-row-AccOwner").should("be.visible");
      });
    });
  });

  it("declines an invitation via the UI", () => {
    let ownerData: UserSetupData;
    let allianceId: string;
    let inviteeLogin: string;

    setupUser("alliance-decline-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "DeclineOwner", true);
    }).then((ownerAccount) => {
      return cy.apiCreateAlliance(
        ownerData.access_token, "DeclineAlliance", "DA", ownerAccount.id
      );
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("alliance-decline-invitee-token");
    }).then((invitee) => {
      inviteeLogin = invitee.login;
      return cy.apiCreateGameAccount(invitee.access_token, "DeclinePlayer", true);
    }).then((inviteeAccount) => {
      cy.apiInviteMember(ownerData.access_token, allianceId, inviteeAccount.id);

      cy.uiLogin(inviteeLogin);
      cy.navTo("alliances");

      cy.getByCy("my-invitations-section").should("be.visible");
      cy.getByCy("decline-invitation").click();

      // After declining, invitations section disappears and no alliance card
      cy.getByCy("my-invitations-section").should("not.exist");
      cy.getByCy("alliance-empty-text").should("contain", "No alliances yet");
    });
  });
});
