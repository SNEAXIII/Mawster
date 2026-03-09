import { setupUser, setupAdmin } from "../support/e2e";

describe("Login & Profile – UI", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it("shows the login page with Sign In title and Discord button", () => {
    cy.visit("/login");
    cy.contains("Sign In").should("be.visible");
    cy.contains("Sign in with Discord").should("be.visible");
  });

  it("shows registered users in the dev-mode picker", () => {
    setupUser("dev-picker-token").then(({ login }) => {
      cy.visit("/login");
      cy.contains(login).should("be.visible");
    });
  });

  it("logs in via dev-login and redirects away from /login", () => {
    setupUser("ui-login-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.url().should("not.include", "/login");
    });
  });

  it("displays profile info after login", () => {
    setupUser("profile-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.visit("/profile");
      cy.contains(login).should("be.visible");
      cy.contains("Account Information").should("be.visible");
      cy.contains("Username").should("be.visible");
      cy.contains("Email").should("be.visible");
      cy.contains("Discord ID").should("be.visible");
    });
  });

  it("shows admin role badge for admin users", () => {
    setupAdmin("admin-badge-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.visit("/profile");
      cy.contains("admin").should("be.visible");
    });
  });

  it("signs out and redirects to login", () => {
    setupUser("signout-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.visit("/profile");
      cy.contains("Sign out").click();
      cy.url().should("include", "/login");
    });
  });

  it("redirects unauthenticated users to login", () => {
    cy.visit("/profile");
    cy.url().should("include", "/login");
  });
});
