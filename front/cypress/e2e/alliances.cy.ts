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

  it("shows a message when no game accounts exist", () => {
    setupUser("alliance-noacc-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.visit("/game/alliances");
      cy.contains("create a game account first").should("be.visible");
    });
  });

  it("creates an alliance via the UI form", () => {
    setupUser("alliance-create-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "AllianceLeader", true);

      cy.uiLogin(login);
      cy.visit("/game/alliances");

      // Open the Create an alliance form
      cy.contains("Create an alliance").click();

      // Fill in alliance details
      cy.get("#name").type("TestAlliance");
      cy.get("#tag").type("TA");

      // Select the owner from the dropdown
      cy.get('[data-testid="owner-select"]').should("exist").then(($el) => {
        // If a data-testid selector, click to open
        if ($el.length) {
          cy.wrap($el).click();
          cy.contains("AllianceLeader").click();
        }
      });

      // If no data-testid, fall back to label-based selection
      cy.get("body").then(($body) => {
        if ($body.find('[data-testid="owner-select"]').length === 0) {
          // Try clicking the Select trigger near the Leader label
          cy.contains("Leader")
            .parent()
            .find("button[role='combobox']")
            .click();
          cy.contains("AllianceLeader").click();
        }
      });

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
    setupUser("alliance-owner-token").then((owner) => {
      cy.apiCreateGameAccount(owner.access_token, "OwnerAcc", true).then(
        (ownerAccount) => {
          cy.apiCreateAlliance(
            owner.access_token,
            "InviteAlliance",
            "IA",
            ownerAccount.id
          );
        }
      );

      // Create a second user with a game account
      setupUser("alliance-invitee-token").then((invitee) => {
        cy.apiCreateGameAccount(invitee.access_token, "InviteeAcc", true);

        // Login as owner and invite
        cy.uiLogin(owner.login);
        cy.visit("/game/alliances");

        cy.contains("InviteAlliance").should("be.visible");
        cy.contains("Invite member").click();

        // Select the invitee account from the dropdown
        cy.get("button[role='combobox']").last().click();
        cy.contains("InviteeAcc").click();

        // Click the Invite button
        cy.contains("button", "Invite").click();
        cy.contains("Invitation sent successfully").should("be.visible");
      });
    });
  });

  it("accepts an invitation via the UI", () => {
    setupUser("alliance-accept-owner-token").then((owner) => {
      cy.apiCreateGameAccount(owner.access_token, "AccOwner", true).then(
        (ownerAccount) => {
          cy.apiCreateAlliance(
            owner.access_token,
            "JoinAlliance",
            "JA",
            ownerAccount.id
          );

          setupUser("alliance-accept-invitee-token").then((invitee) => {
            cy.apiCreateGameAccount(
              invitee.access_token,
              "JoinPlayer",
              true
            ).then((inviteeAccount) => {
              // Invite via API
              cy.request({
                method: "POST",
                url: "http://localhost:8000/alliances/invite",
                headers: {
                  Authorization: `Bearer ${owner.access_token}`,
                },
                body: {
                  alliance_id: ownerAccount.alliance_id ?? "",
                  game_account_id: inviteeAccount.id,
                },
                failOnStatusCode: false,
              });

              // Login as invitee and accept
              cy.uiLogin(invitee.login);
              cy.visit("/game/alliances");
              cy.contains("My invitations").should("be.visible");
              cy.contains("Accept").click();
              cy.contains("Invitation accepted").should("be.visible");
            });
          });
        }
      );
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
