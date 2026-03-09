import { setupUser, setupAdmin } from "../support/e2e";

describe("Upgrade Requests – UI", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it("hides upgrade requests section when roster is empty", () => {
    setupUser("upgrade-empty-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "UpgradePlayer", true);

      cy.uiLogin(login);
      cy.visit("/game/roster");
      // The Upgrade Requests section returns null when there are no requests
      cy.contains("Upgrade Requests").should("not.exist");
    });
  });

  it("shows upgrade button on a champion card in the roster", () => {
    setupAdmin("upgrade-btn-admin-token").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "UpgradeHero", "Cosmic");

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

        // Select 6★R4 rarity
        cy.contains("button", "6★R4").click();
        cy.contains("button", /^Add \/ Update$/).click();

        cy.contains("UpgradeHero added / updated").should("be.visible");
        // The champion card should be visible in the roster grid
        cy.contains("UpgradeHero").should("be.visible");
      });
    });
  });
});
