import { setupUser } from "../support/e2e";

describe("Defense – UI", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it("shows no-alliance message when user has no alliances", () => {
    setupUser("def-noalliance-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.visit("/game/defense");
      cy.contains("need to join an alliance").should("be.visible");
    });
  });

  it("shows the defense page with alliance and BG selectors", () => {
    setupUser("def-page-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "DefPlayer", true).then(
        (account) => {
          cy.apiCreateAlliance(
            access_token,
            "DefAlliance",
            "DA",
            account.id
          );
        }
      );

      cy.uiLogin(login);
      cy.visit("/game/defense");

      // Verify the page elements
      cy.contains("Defense Placement").should("be.visible");
      cy.contains("Alliance:").should("be.visible");
      cy.contains("Battlegroup:").should("be.visible");
      cy.contains("BG 1").should("be.visible");
      cy.contains("BG 2").should("be.visible");
      cy.contains("BG 3").should("be.visible");
    });
  });

  it("switches between battlegroups", () => {
    setupUser("def-bg-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "BGPlayer", true).then(
        (account) => {
          cy.apiCreateAlliance(
            access_token,
            "BGAlliance",
            "BG",
            account.id
          );
        }
      );

      cy.uiLogin(login);
      cy.visit("/game/defense");

      // BG 1 should be active by default
      cy.contains("BG 1").should("be.visible");

      // Switch to BG 2
      cy.contains("button", "BG 2").click();

      // Switch to BG 3
      cy.contains("button", "BG 3").click();
    });
  });

  it("shows Export button", () => {
    setupUser("def-export-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "ExportPlayer", true).then(
        (account) => {
          cy.apiCreateAlliance(
            access_token,
            "ExportAlliance",
            "EA",
            account.id
          );
        }
      );

      cy.uiLogin(login);
      cy.visit("/game/defense");
      cy.contains("button", "Export").should("be.visible");
    });
  });

  it("shows Import button for alliance managers", () => {
    setupUser("def-import-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "ImportPlayer", true).then(
        (account) => {
          cy.apiCreateAlliance(
            access_token,
            "ImportAlliance",
            "IM",
            account.id
          );
        }
      );

      cy.uiLogin(login);
      cy.visit("/game/defense");
      cy.contains("button", "Import").should("be.visible");
    });
  });

  it("shows the Members side panel", () => {
    setupUser("def-members-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "MembersPlayer", true).then(
        (account) => {
          cy.apiCreateAlliance(
            access_token,
            "MembersAlliance",
            "MP",
            account.id
          );
        }
      );

      cy.uiLogin(login);
      cy.visit("/game/defense");
      cy.contains("Members").should("be.visible");
    });
  });
});
