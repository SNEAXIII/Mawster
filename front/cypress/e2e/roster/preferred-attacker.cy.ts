import { setupRosterUser } from '../../support/e2e';

describe('Roster – Preferred Attacker', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('can toggle preferred attacker on a champion via UI', () => {
    setupRosterUser('pref-toggle', 'PrefPlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Blade', 'Skill').then((champs) => {
        cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r2');

        cy.uiLogin(userData.login);
        cy.navTo('roster');

        // Champion should NOT be a preferred attacker initially
        cy.getByCy('preferred-attacker-name').should('not.exist');

        // Click the ⚔ toggle button (force: action buttons are hover-visible)
        cy.getByCy('preferred-attacker-toggle').first().click({ force: true });

        // Now the champion name should show the ⚔ prefix (yellow)
        cy.getByCy('preferred-attacker-name').should('be.visible');
      });
    });
  });

  it('preferred attacker persists after page reload', () => {
    setupRosterUser('pref-persist', 'PersistPlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Ghost', 'Tech').then((champs) => {
        cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r3', {
          is_preferred_attacker: true,
        });

        cy.uiLogin(userData.login);
        cy.navTo('roster');

        // Should show ⚔ prefix on the champion name
        cy.getByCy('preferred-attacker-name').should('be.visible');

        // Reload and verify it persists
        cy.reload();
        cy.getByCy('preferred-attacker-name').should('be.visible');
      });
    });
  });

  it('can untoggle preferred attacker', () => {
    setupRosterUser('pref-untoggle', 'UntogglePlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Quake', 'Science').then((champs) => {
        // Set as preferred attacker via API
        cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r1', {
          is_preferred_attacker: true,
        });

        cy.uiLogin(userData.login);
        cy.navTo('roster');

        // Should initially show ⚔ yellow name
        cy.getByCy('preferred-attacker-name').should('be.visible');

        // Click the ⚔ toggle to turn it OFF
        cy.getByCy('preferred-attacker-toggle').first().click({ force: true });

        // ⚔ prefix should be gone from the champion name
        cy.getByCy('preferred-attacker-name').should('not.exist');
      });
    });
  });

  it('preferred attacker flag is set via the add form checkbox', () => {
    setupRosterUser('pref-form', 'CorvusPlayer').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'Corvus', 'Cosmic');

      cy.uiLogin(userData.login);
      cy.navTo('roster');

      cy.contains('Add / Update a Champion').click();
      cy.getByCy('champion-search').type('Corvus');
      cy.getByCy('champion-result-Corvus').click();
      cy.getByCy('rarity-7r2').click();

      // Check the Preferred Attacker checkbox
      cy.contains('Preferred Attacker').click();

      cy.getByCy('champion-submit').click();
      cy.contains('Corvus added / updated').should('be.visible');

      // Should show ⚔ prefix (yellow name)
      cy.getByCy('preferred-attacker-name').should('be.visible');
    });
  });

  it('multiple champions can be preferred attackers simultaneously', () => {
    setupRosterUser('pref-multi', 'MultiPrefPlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'NickFuryM', 'Skill').then((c1) => {
        cy.apiLoadChampion(adminData.access_token, 'AegonM', 'Science').then((c2) => {
          cy.apiAddChampionToRoster(userData.access_token, accountId, c1[0].id, '7r2', {
            is_preferred_attacker: true,
          });
          cy.apiAddChampionToRoster(userData.access_token, accountId, c2[0].id, '7r3', {
            is_preferred_attacker: true,
          });

          cy.uiLogin(userData.login);
          cy.navTo('roster');

          // Both should show ⚔ prefix yellow name
          cy.getByCy('preferred-attacker-name').should('have.length', 2);
        });
      });
    });
  });
});
