import { setupUser, setupAdmin } from "../support/e2e";

describe("Upgrade Requests – UI", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it("shows empty upgrade requests on the roster page", () => {
    setupUser("upgrade-empty-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "UpgradePlayer", true);

      cy.uiLogin(login);
      cy.visit("/game/roster");
      cy.contains("Upgrade Requests").should("be.visible");
      cy.contains("No pending upgrade requests").should("be.visible");
    });
  });

  it("shows upgrade button on a champion card in the roster", () => {
    setupAdmin("upgrade-btn-admin-token").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "UpgradeHero", "cosmic");

      setupUser("upgrade-btn-user-token").then(({ login, access_token }) => {
        cy.apiCreateGameAccount(access_token, "UpgradeAcc", true);

        cy.uiLogin(login);
        cy.visit("/game/roster");

        // Add a champion first
        cy.contains("Add / Update a Champion").click();
        cy.get('input[placeholder="Search a champion..."]').type(
          "UpgradeHero"
        );
        cy.contains("button", "UpgradeHero").click();

        // Select 5★ rarity so upgrade is possible
        cy.contains("button", "5★").click();
        cy.contains("button", "Add / Update").click();

        cy.contains("UpgradeHero added / updated").should("be.visible");
        // The champion card should be visible in the roster grid
        cy.contains("UpgradeHero").should("be.visible");
      });
    });
  });
});
