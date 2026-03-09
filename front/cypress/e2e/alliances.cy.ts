import { setupUser } from "../support/e2e";

describe("Alliances – UI", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it("shows the alliances page title", () => {
    setupUser("alliance-page-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.visit("/game/alliances");
      cy.contains("Alliances").should("be.visible");
    });
  });

  it("shows empty state when user has no game accounts", () => {
    setupUser("alliance-noacc-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.visit("/game/alliances");
      cy.contains("No alliances yet").should("be.visible");
    });
  });

  it("creates an alliance via the UI form", () => {
    setupUser("alliance-create-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "AllianceLeader", true);

      cy.uiLogin(login);
      cy.visit("/game/alliances");

      // Form auto-opens when user has no alliances (useEffect)
      // Fill in alliance details (owner is auto-selected when only one account)
      cy.get("#name").should("be.visible").type("TestAlliance");
      cy.get("#tag").type("TA");

      // Submit the form
      cy.contains("button", "Create alliance").click();

      // Verify the alliance appears
      cy.contains("Alliance created successfully").should("be.visible");
      cy.contains("TestAlliance").should("be.visible");
      cy.contains("[TA]").should("be.visible");
    });
  });

  it("shows alliance members after creation", () => {
    setupUser("alliance-members-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "LeaderAcc", true).then(
        (account) => {
          cy.apiCreateAlliance(
            access_token,
            "MyAlliance",
            "MA",
            account.id
          );
        }
      );

      cy.uiLogin(login);
      cy.visit("/game/alliances");
      cy.contains("MyAlliance").should("be.visible");
      cy.contains("Members").should("be.visible");
      cy.contains("LeaderAcc").should("be.visible");
    });
  });

  it("invites a member to an alliance", () => {
    let ownerData: { access_token: string; login: string };

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
      // Create a second user with a game account
      return setupUser("alliance-newmember-token");
    }).then((newMember) => {
      return cy.apiCreateGameAccount(newMember.access_token, "NewMemberAcc", true);
    }).then(() => {
      // Login as owner and invite
      cy.uiLogin(ownerData.login);
      cy.visit("/game/alliances");

      cy.contains("InviteAlliance").should("be.visible");

      // Intercept eligible members API
      cy.intercept("GET", "**/alliances/eligible-members").as("eligibleMembers");
      cy.contains("Invite member").click();
      cy.wait("@eligibleMembers");

      // Wait for React to process the eligible members
      cy.wait(500);

      // Click the invite member Select (identified by its placeholder text)
      cy.contains("Select an account").click();

      // Select NewMemberAcc from the dropdown
      cy.contains("[role='option']", "NewMemberAcc", { timeout: 1000 }).click();

      // Click the Invite button
      cy.contains("button", "Invite",{ timeout: 1000 }).click();
      cy.contains("Invitation sent successfully").should("be.visible");
      cy.contains("NewMemberAcc").should("be.visible");
      cy.contains("Pending invitations (1)").should("be.visible");
    });
  });

  it("accepts an invitation via the UI", () => {
    let ownerData: { access_token: string; login: string };
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
      // Invite via API
      cy.request({
        method: "POST",
        url: `http://localhost:8000/alliances/${allianceId}/invitations`,
        headers: { Authorization: `Bearer ${ownerData.access_token}` },
        body: { game_account_id: inviteeAccount.id },
      });

      // Login as invitee and accept
      cy.uiLogin(inviteeLogin);
      cy.visit("/game/alliances");
      cy.contains("My invitations").should("be.visible");
      cy.contains("Accept").click();
      cy.contains("Invitation accepted").should("be.visible");
    });
  });

  it("shows the empty state when no alliances exist", () => {
    setupUser("alliance-empty-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "EmptyAcc", true);
      cy.uiLogin(login);
      cy.visit("/game/alliances");
      cy.contains("No alliances yet").should("be.visible");
    });
  });
});
