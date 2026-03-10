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

      // Form is already open (defaultOpen when no accounts)
      cy.getByCy('account-pseudo-input').scrollIntoView().type("MyGamePseudo");
      cy.getByCy('account-create-btn').click();

      // Verify the account appears in the list
      cy.contains("MyGamePseudo").scrollIntoView().should("be.visible");

      // Verify the toast
      cy.contains("Game account created successfully").should("be.visible");
    });
  });

  it("shows the Primary badge on the first created account", () => {
    setupUser("ga-primary-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.visit("/profile");

      // Form is already open (defaultOpen when no accounts)
      cy.getByCy('account-pseudo-input').scrollIntoView().type("PrimaryPlayer");
      cy.getByCy('account-create-btn').click();

      cy.contains("PrimaryPlayer").scrollIntoView().should("be.visible");
      cy.contains("Primary").should("be.visible");
    });
  });

  it("edits a game account pseudo via the pencil icon", () => {
    setupUser("ga-edit-token").then(({ login, access_token }) => {
      // Create account via API for speed
      cy.apiCreateGameAccount(access_token, "OldPseudo", true);

      cy.uiLogin(login);
      cy.visit("/profile");
      cy.contains("OldPseudo").scrollIntoView().should("be.visible");

      // Click the pencil (edit) button
      cy.getByCy('account-row-OldPseudo')
        .find('[data-cy="account-edit-btn"]')
        .click({ force: true });

      // Clear old value and type new one
      cy.get('input[maxlength="50"]').clear().type("NewPseudo");

      // Click the green check to confirm
      cy.getByCy('account-edit-confirm').first().click({ force: true });

      // Verify the rename toast and new pseudo
      cy.contains("Game account renamed successfully").should("be.visible");
      cy.contains("NewPseudo").scrollIntoView().should("be.visible");
    });
  });

  it("deletes a game account with confirmation dialog", () => {
    setupUser("ga-delete-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "ToDelete", true);

      cy.uiLogin(login);
      cy.visit("/profile");
      cy.contains("ToDelete").scrollIntoView().should("be.visible");

      // Click the delete (trash) button
      cy.getByCy('account-row-ToDelete')
        .find('[data-cy="account-delete-btn"]')
        .click({ force: true });

      // Confirmation dialog should appear
      cy.get('[role="alertdialog"]').should("be.visible");

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
      cy.contains("No game accounts yet").scrollIntoView().should("be.visible");
    });
  });

  it("displays account count", () => {
    setupUser("ga-count-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "Account1", true);
      cy.apiCreateGameAccount(access_token, "Account2", false);

      cy.uiLogin(login);
      cy.visit("/profile");
      cy.contains("2/10 accounts").scrollIntoView().should("be.visible");
    });
  });
});
