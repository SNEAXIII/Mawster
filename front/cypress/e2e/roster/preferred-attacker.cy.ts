import { setupUser, setupAdmin } from "../../support/e2e";

describe("Roster – Preferred Attacker", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it("can toggle preferred attacker on a champion via UI", () => {
    setupAdmin("pref-toggle-admin").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "Blade", "Skill").then((champs) => {
        setupUser("pref-toggle-user").then(({ login, access_token }) => {
          cy.apiCreateGameAccount(access_token, "PrefPlayer", true).then((acc) => {
            cy.apiAddChampionToRoster(access_token, acc.id, champs[0].id, "7r2");

            cy.uiLogin(login);
            cy.navTo("roster");

            // Champion should NOT be a preferred attacker initially
            cy.getByCy("preferred-attacker-name").should("not.exist");

            // Click the ⚔ toggle button (force: action buttons are hover-visible)
            cy.getByCy("preferred-attacker-toggle").first().click({ force: true });

            // Now the champion name should show the ⚔ prefix (yellow)
            cy.getByCy("preferred-attacker-name").should("be.visible");
          });
        });
      });
    });
  });

  it("preferred attacker persists after page reload", () => {
    setupAdmin("pref-persist-admin").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "Ghost", "Tech").then((champs) => {
        setupUser("pref-persist-user").then(({ login, access_token }) => {
          cy.apiCreateGameAccount(access_token, "PersistPlayer", true).then((acc) => {
            cy.apiAddChampionToRoster(access_token, acc.id, champs[0].id, "7r3", {
              is_preferred_attacker: true,
            });

            cy.uiLogin(login);
            cy.navTo("roster");

            // Should show ⚔ prefix on the champion name
            cy.getByCy("preferred-attacker-name").should("be.visible");

            // Reload and verify it persists
            cy.reload();
            cy.getByCy("preferred-attacker-name").should("be.visible");
          });
        });
      });
    });
  });

  it("can untoggle preferred attacker", () => {
    setupAdmin("pref-untoggle-admin").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "Quake", "Science").then((champs) => {
        setupUser("pref-untoggle-user").then(({ login, access_token }) => {
          cy.apiCreateGameAccount(access_token, "UntogglePlayer", true).then((acc) => {
            // Set as preferred attacker via API
            cy.apiAddChampionToRoster(access_token, acc.id, champs[0].id, "7r1", {
              is_preferred_attacker: true,
            });

            cy.uiLogin(login);
            cy.navTo("roster");

            // Should initially show ⚔ yellow name
            cy.getByCy("preferred-attacker-name").should("be.visible");

            // Click the ⚔ toggle to turn it OFF
            cy.getByCy("preferred-attacker-toggle").first().click({ force: true });

            // ⚔ prefix should be gone from the champion name
            cy.getByCy("preferred-attacker-name").should("not.exist");
          });
        });
      });
    });
  });

  it("preferred attacker flag is set via the add form checkbox", () => {
    setupAdmin("pref-form-admin").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "Corvus", "Cosmic");

      setupUser("pref-form-user").then(({ login, access_token }) => {
        cy.apiCreateGameAccount(access_token, "CorvusPlayer", true);

        cy.uiLogin(login);
        cy.navTo("roster");

        cy.contains("Add / Update a Champion").click();
        cy.getByCy("champion-search").type("Corvus");
        cy.getByCy("champion-result-Corvus").click();
        cy.getByCy("rarity-7r2").click();

        // Check the Preferred Attacker checkbox
        cy.contains("Preferred Attacker").click();

        cy.getByCy("champion-submit").click();
        cy.contains("Corvus added / updated").should("be.visible");

        // Should show ⚔ prefix (yellow name)
        cy.getByCy("preferred-attacker-name").should("be.visible");
      });
    });
  });

  it("multiple champions can be preferred attackers simultaneously", () => {
    setupAdmin("pref-multi-admin").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "NickFuryM", "Skill").then((c1) => {
        cy.apiLoadChampion(admin.access_token, "AegonM", "Science").then((c2) => {
          setupUser("pref-multi-user").then(({ login, access_token }) => {
            cy.apiCreateGameAccount(access_token, "MultiPrefPlayer", true).then((acc) => {
              cy.apiAddChampionToRoster(access_token, acc.id, c1[0].id, "7r2", {
                is_preferred_attacker: true,
              });
              cy.apiAddChampionToRoster(access_token, acc.id, c2[0].id, "7r3", {
                is_preferred_attacker: true,
              });

              cy.uiLogin(login);
              cy.navTo("roster");

              // Both should show ⚔ prefix yellow name
              cy.getByCy("preferred-attacker-name").should("have.length", 2);
            });
          });
        });
      });
    });
  });
});
