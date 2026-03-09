import { setupUser } from "../support/e2e";

describe("Game Accounts – UI", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it("shows the game accounts section on the profile page", () => {
    setupUser("ga-section-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.visit("/profile");
      cy.contains("Game Accounts").should("be.visible");
    });
  });

  it("creates a game account via the profile form", () => {
    setupUser("ga-create-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.visit("/profile");

      // Open the Add a Game Account section
      cy.contains("Add a Game Account").click();

      // Fill in pseudo and submit
      cy.get("#pseudo").type("MyGamePseudo");
      cy.contains("button", "Add account").click();

      // Verify the account appears in the list
      cy.contains("MyGamePseudo").should("be.visible");

      // Verify the toast
      cy.contains("Game account created successfully").should("be.visible");
    });
  });

  it("shows the Primary badge on the first created account", () => {
    setupUser("ga-primary-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.visit("/profile");

      cy.contains("Add a Game Account").click();
      cy.get("#pseudo").type("PrimaryPlayer");
      cy.contains("button", "Add account").click();

      cy.contains("PrimaryPlayer").should("be.visible");
      cy.contains("Primary").should("be.visible");
    });
  });

  it("edits a game account pseudo via the pencil icon", () => {
    setupUser("ga-edit-token").then(({ login, access_token }) => {
      // Create account via API for speed
      cy.apiCreateGameAccount(access_token, "OldPseudo", true);

      cy.uiLogin(login);
      cy.visit("/profile");
      cy.contains("OldPseudo").should("be.visible");

      // Click the pencil (edit) button
      cy.get('[class*="text-blue"]').filter(':has(svg)').first().click();

      // Clear old value and type new one
      cy.get('input[maxlength="50"]').clear().type("NewPseudo");

      // Click the green check to confirm
      cy.get('[class*="text-green"]').filter(':has(svg)').first().click();

      // Verify the rename toast and new pseudo
      cy.contains("Game account renamed successfully").should("be.visible");
      cy.contains("NewPseudo").should("be.visible");
    });
  });

  it("deletes a game account with confirmation dialog", () => {
    setupUser("ga-delete-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "ToDelete", true);

      cy.uiLogin(login);
      cy.visit("/profile");
      cy.contains("ToDelete").should("be.visible");

      // Click the delete (trash) button
      cy.get('[class*="text-red"]').filter(':has(svg)').first().click();

      // Confirmation dialog should appear
      cy.contains("Are you sure you want to delete this game account").should(
        "be.visible"
      );

      // Click Delete in the dialog
      cy.get('[role="alertdialog"]').contains("button", "Delete").click();

      // Verify account is removed
      cy.contains("Game account deleted successfully").should("be.visible");
      cy.contains("ToDelete").should("not.exist");
    });
  });

  it("shows empty state when no accounts exist", () => {
    setupUser("ga-empty-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.visit("/profile");
      cy.contains("No game accounts yet").should("be.visible");
    });
  });

  it("displays account count", () => {
    setupUser("ga-count-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "Account1", true);
      cy.apiCreateGameAccount(access_token, "Account2", false);

      cy.uiLogin(login);
      cy.visit("/profile");
      cy.contains("2/10 accounts").should("be.visible");
    });
  });
});
