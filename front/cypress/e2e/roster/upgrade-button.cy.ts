import { setupUser, setupAdmin, BACKEND } from "../../support/e2e";


describe("Roster – Champion Upgrade", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Basic upgrade
  // =========================================================================

  it("upgrades a champion one rank via UI and verifies rarity group", () => {
    setupAdmin("upg-basic-admin").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "Hercules", "Cosmic").then((champs) => {
        setupUser("upg-basic-user").then(({ login, access_token }) => {
          cy.apiCreateGameAccount(access_token, "HercPlayer", true).then((acc) => {
            cy.apiAddChampionToRoster(access_token, acc.id, champs[0].id, "7r1");

            cy.uiLogin(login);
            cy.navTo("roster");

            // Champion should start in the 7r1 group
            cy.getByCy("rarity-group-7r1").should("exist");
            cy.getByCy("rarity-group-7r1").contains("Hercules").should("be.visible");

            // Click the upgrade button on the champion card
            cy.getByCy("champion-upgrade").first().click({ force: true });

            // Confirm upgrade in the dialog
            cy.get('[role="alertdialog"]').should("be.visible");
            cy.get('[role="alertdialog"]').contains("button", "Upgrade").click();

            // Champion should now be in the 7r2 group
            cy.getByCy("rarity-group-7r2").should("exist");
            cy.getByCy("rarity-group-7r2").contains("Hercules").should("be.visible");
            // The 7r1 group should be gone (only champion was moved)
            cy.getByCy("rarity-group-7r1").should("not.exist");
          });
        });
      });
    });
  });

  it("upgrade button is visible on a champion that is not at max rank", () => {
    setupAdmin("upg-btn-admin").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "DoctorDoom", "Mystic").then((champs) => {
        setupUser("upg-btn-user").then(({ login, access_token }) => {
          cy.apiCreateGameAccount(access_token, "DoomPlayer", true).then((acc) => {
            cy.apiAddChampionToRoster(access_token, acc.id, champs[0].id, "7r2");

            cy.uiLogin(login);
            cy.navTo("roster");
            cy.getByCy("champion-upgrade").should("exist");
          });
        });
      });
    });
  });

  it("upgrade button is NOT visible on a champion at max rank (7r5)", () => {
    setupAdmin("upg-max-admin").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "MaxRankHero", "Tech").then((champs) => {
        setupUser("upg-max-user").then(({ login, access_token }) => {
          cy.apiCreateGameAccount(access_token, "MaxPlayer", true).then((acc) => {
            cy.apiAddChampionToRoster(access_token, acc.id, champs[0].id, "7r5");

            cy.uiLogin(login);
            cy.navTo("roster");
            cy.getByCy("champion-upgrade").should("not.exist");
          });
        });
      });
    });
  });

  it("cannot upgrade past max rank via API", () => {
    setupAdmin("upg-past-admin").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "MaxPastHero", "Skill").then((champs) => {
        setupUser("upg-past-user").then(({ access_token }) => {
          cy.apiCreateGameAccount(access_token, "MaxPastPlayer", true).then((acc) => {
            cy.apiAddChampionToRoster(access_token, acc.id, champs[0].id, "7r5").then((cu) => {
              cy.request({
                method: "PATCH",
                url: `${BACKEND}/champion-users/${cu.id}/upgrade`,
                headers: { Authorization: `Bearer ${access_token}` },
                failOnStatusCode: false,
              }).then((res) => {
                expect(res.status).to.be.oneOf([400, 422]);
              });
            });
          });
        });
      });
    });
  });

  // =========================================================================
  // Multiple sequential upgrades
  // =========================================================================

  it("can upgrade champion through multiple ranks sequentially via UI", () => {
    setupAdmin("upg-multi-admin").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "MultUpHero", "Mutant").then((champs) => {
        setupUser("upg-multi-user").then(({ login, access_token }) => {
          cy.apiCreateGameAccount(access_token, "MultUpPlayer", true).then((acc) => {
            cy.apiAddChampionToRoster(access_token, acc.id, champs[0].id, "7r1");

            cy.uiLogin(login);
            cy.navTo("roster");

            // Verify starting group
            cy.getByCy("rarity-group-7r1").contains("MultUpHero").should("be.visible");

            // Upgrade 7r1 → 7r2
            cy.getByCy("champion-upgrade").first().click({ force: true });
            cy.get('[role="alertdialog"]').contains("button", "Upgrade").click();
            cy.getByCy("rarity-group-7r2").contains("MultUpHero").should("be.visible");

            // Upgrade 7r2 → 7r3
            cy.getByCy("champion-upgrade").first().click({ force: true });
            cy.get('[role="alertdialog"]').contains("button", "Upgrade").click();
            cy.getByCy("rarity-group-7r3").contains("MultUpHero").should("be.visible");

            // Upgrade 7r3 → 7r4
            cy.getByCy("champion-upgrade").first().click({ force: true });
            cy.get('[role="alertdialog"]').contains("button", "Upgrade").click();
            cy.getByCy("rarity-group-7r4").contains("MultUpHero").should("be.visible");
          });
        });
      });
    });
  });
});