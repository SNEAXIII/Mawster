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
      cy.apiLoadChampion(admin.access_token, "Spider-Man", "science");

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
      cy.apiLoadChampion(admin.access_token, "Wolverine", "mutant");

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

          // Select rarity (click 6★)
          cy.contains("button", "6★").click();

          // Submit
          cy.contains("button", "Add / Update").click();

          // Verify toast and champion in grid
          cy.contains("Wolverine added / updated").should("be.visible");
          cy.contains("Wolverine").should("be.visible");
        }
      );
    });
  });

  it("deletes a champion from the roster", () => {
    setupAdmin("roster-del-admin-token").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "HulkDel", "science");

      setupUser("roster-del-user-token").then(({ login, access_token }) => {
        cy.apiCreateGameAccount(access_token, "HulkPlayer", true);

        cy.uiLogin(login);
        cy.visit("/game/roster");

        // Add champion first
        cy.contains("Add / Update a Champion").click();
        cy.get('input[placeholder="Search a champion..."]').type("HulkDel");
        cy.contains("button", "HulkDel").click();
        cy.contains("button", "Add / Update").click();
        cy.contains("HulkDel added / updated").should("be.visible");

        // Now delete the champion via the delete button in the grid
        cy.get('[data-testid="roster-delete"], button[title*="delete"], button[title*="Delete"]')
          .first()
          .click({ force: true })
          .then(() => {
            // If no data-testid, try the trash icon button
          });

        // Fallback: find any trash icon button near HulkDel
        cy.get("body").then(($body) => {
          if ($body.find('[role="alertdialog"]').length === 0) {
            // Try clicking the delete button in the champion card
            cy.contains("HulkDel")
              .parents('[class*="rounded"]')
              .find('button')
              .last()
              .click({ force: true });
          }
        });

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

  it("shows the Upgrade Requests section", () => {
    setupUser("roster-upgrades-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "UpgradeAcc", true);

      cy.uiLogin(login);
      cy.visit("/game/roster");
      cy.contains("Upgrade Requests").should("be.visible");
      cy.contains("No pending upgrade requests").should("be.visible");
    });
  });
});
