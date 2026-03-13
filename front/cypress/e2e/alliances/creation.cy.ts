import { setupUser, type UserSetupData } from "../../support/e2e";

describe("Alliances – Creation", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it("shows the alliances page title", () => {
    setupUser("alliance-page-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo("alliances");
      cy.contains("Alliances").should("be.visible");
    });
  });

  it("shows empty state when user has no game accounts", () => {
    setupUser("alliance-noacc-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo("alliances");
      cy.contains("Browse and create alliances for your alliance wars.").should("be.visible");
      cy.contains("No alliances yet. Create the first one!").should("be.visible");
    });
  });

  it("creates an alliance via the UI form and verifies displayed content", () => {
    setupUser("alliance-create-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "AllianceLeader", true);

      cy.uiLogin(login);
      cy.navTo("alliances");

      cy.getByCy("tab-create").click();
      cy.getByCy("alliance-name-input").should("be.visible").type("TestAlliance");
      cy.getByCy("alliance-tag-input").type("TA");
      cy.getByCy("alliance-create-btn").click();

      cy.contains("Alliance created successfully").should("be.visible");
      cy.getByCy("alliance-card-TestAlliance").should("be.visible");
      cy.getByCy("alliance-card-TestAlliance").within(() => {
        cy.getByCy("alliance-name").should("contain", "TestAlliance");
        cy.getByCy("alliance-tag").should("contain", "[TA]");
        cy.getByCy("alliance-officer-count").should("contain", "0 officers");
        cy.contains("AllianceLeader").should("be.visible");
      });
    });
  });

  it("shows alliance members with correct roles after creation", () => {
    setupUser("alliance-members-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "LeaderAcc", true).then(
        (account) => {
          cy.apiCreateAlliance(access_token, "MyAlliance", "MA", account.id);
        }
      );

      cy.uiLogin(login);
      cy.navTo("alliances");

      cy.getByCy("alliance-card-MyAlliance").should("be.visible").within(() => {
        cy.getByCy("alliance-name").should("contain", "MyAlliance");
        cy.getByCy("alliance-tag").should("contain", "[MA]");
        cy.contains("Members").should("be.visible");
        cy.getByCy("member-row-LeaderAcc").should("be.visible");
        cy.getByCy("member-row-LeaderAcc").should("contain", "LeaderAcc");
      });
    });
  });

  it("shows the empty state when user has game accounts but no alliances", () => {
    setupUser("alliance-empty-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "EmptyAcc", true);
      cy.uiLogin(login);
      cy.navTo("alliances");
      cy.getByCy("alliance-empty-text").should("contain", "No alliances yet");
    });
  });
});
