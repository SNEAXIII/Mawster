import { setupUser, setupAdmin } from "../support/e2e";

describe("Roster – UI", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it("shows no-accounts message when user has no game accounts", () => {
    setupUser("roster-noacc-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.visit("/game/roster");
      cy.contains("create a game account first").should("be.visible");
    });
  });

  it("shows empty roster message", () => {
    setupUser("roster-empty-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "EmptyRoster", true);

      cy.uiLogin(login);
      cy.visit("/game/roster");
      cy.contains("roster is empty").should("be.visible");
    });
  });

  it("opens the Add Champion form and searches for a champion", () => {
    setupAdmin("roster-add-admin-token").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "Spider-Man", "Science");

      setupUser("roster-add-user-token").then(({ login, access_token }) => {
        cy.apiCreateGameAccount(access_token, "RosterPlayer", true);

        cy.uiLogin(login);
        cy.visit("/game/roster");

        // Open form
        cy.contains("Add / Update a Champion").click();

        // Search for champion
        cy.get('input[placeholder="Search a champion..."]').type("Spider");

        // Verify search results appear
        cy.contains("Spider-Man").should("be.visible");
      });
    });
  });

  it("adds a champion to the roster", () => {
    setupAdmin("roster-addchamp-admin-token").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "Wolverine", "Mutant");

      setupUser("roster-addchamp-user-token").then(
        ({ login, access_token }) => {
          cy.apiCreateGameAccount(access_token, "WolverinePlayer", true);

          cy.uiLogin(login);
          cy.visit("/game/roster");

          // Open form
          cy.contains("Add / Update a Champion").click();

          // Search and select champion
          cy.get('input[placeholder="Search a champion..."]').type("Wolverine");
          cy.contains("button", "Wolverine").click();

          // Select rarity (click 6★R4)
          cy.contains("button", "6★R4").click();

          // Submit
          cy.contains("button", /^Add \/ Update$/).click();

          cy.contains("Wolverine added / updated").should("be.visible");
          cy.contains("Wolverine").should("exist");
        }
      );
    });
  });

  it("deletes a champion from the roster", () => {
    setupAdmin("roster-del-admin-token").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "HulkDel", "Science");

      setupUser("roster-del-user-token").then(({ login, access_token }) => {
        cy.apiCreateGameAccount(access_token, "HulkPlayer", true);

        cy.uiLogin(login);
        cy.visit("/game/roster");

        // Add champion first
        cy.contains("Add / Update a Champion").click();
        cy.get('input[placeholder="Search a champion..."]').type("HulkDel");
        cy.contains("button", "HulkDel").click();
        cy.contains("button", "6★R4").click();
        cy.contains("button", /^Add \/ Update$/).click();
        cy.contains("HulkDel added / updated").should("be.visible");

        // Now delete the champion via the delete button on the card
        cy.get('button[title="Delete"]').first().click({ force: true });

        // Confirm deletion dialog
        cy.get('[role="alertdialog"]')
          .should("be.visible")
          .contains("button", "Delete")
          .click();

        cy.contains("HulkDel removed from roster").should("be.visible");
      });
    });
  });

  it("shows account selector when user has multiple accounts", () => {
    setupUser("roster-multi-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "Account1", true);
      cy.apiCreateGameAccount(access_token, "Account2", false);

      cy.uiLogin(login);
      cy.visit("/game/roster");
      cy.contains("Select a game account").should("be.visible");
    });
  });

  it("hides upgrade requests section when no requests exist", () => {
    setupUser("roster-upgrades-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "UpgradeAcc", true);

      cy.uiLogin(login);
      cy.visit("/game/roster");
      // The Upgrade Requests component returns null when there are no requests
      cy.contains("Upgrade Requests").should("not.exist");
    });
  });
});
