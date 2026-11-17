import { setupAllianceWithMember, setupRosterUser, setupUser } from '../../support/e2e';

describe('Roster – Attack Preference', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('can set a champion as preferred attacker from its dialog', () => {
    setupRosterUser('pref-toggle', 'PrefPlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Blade', 'Skill').then((champs) => {
        cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r2');

        cy.apiLogin(userData.user_id, 'roster');

        // Champion should NOT be a preferred attacker initially
        cy.getByCy('preferred-attacker-name').should('not.exist');

        cy.getByCy('champion-card-Blade').click();
        cy.getByCy('attack-preference-neutral').should('have.attr', 'data-active');
        cy.getByCy('attack-preference-preferred').click();
        cy.getByCy('attack-preference-preferred').should('have.attr', 'data-active');

        // Now the champion name should be yellow
        cy.getByCy('champion-card-Blade').find('[data-cy="preferred-attacker-name"]').should('exist');
      });
    });
  });

  it('can set a preferred attacker back to neutral', () => {
    setupRosterUser('pref-untoggle', 'UntogglePlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Quake', 'Science').then((champs) => {
        cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r1', {
          attack_preference: 'preferred',
        });

        cy.apiLogin(userData.user_id, 'roster');

        // Should initially show the yellow name
        cy.getByCy('preferred-attacker-name').should('be.visible');

        cy.getByCy('champion-card-Quake').click();
        cy.getByCy('attack-preference-preferred').should('have.attr', 'data-active');
        cy.getByCy('attack-preference-neutral').click();

        // Yellow name should be gone from the champion card
        cy.getByCy('preferred-attacker-name').should('not.exist');
      });
    });
  });

  it('setting detested shows the red halo and name, neutral clears both', () => {
    setupRosterUser('pref-detested', 'DetestPlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Gambit', 'Mutant').then((champs) => {
        cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r2');

        cy.apiLogin(userData.user_id, 'roster');

        cy.getByCy('champion-card-Gambit').find('[data-cy="detested-badge"]').should('not.exist');

        cy.getByCy('champion-card-Gambit').click();
        cy.getByCy('attack-preference-detested').click();
        cy.getByCy('attack-preference-detested').should('have.attr', 'data-active');

        cy.getByCy('champion-card-Gambit').find('[data-cy="detested-badge"]').should('exist');
        cy.getByCy('champion-card-Gambit').find('[data-cy="detested-attacker-name"]').should('exist');
        cy.getByCy('champion-card-Gambit').find('[data-cy="preferred-badge"]').should('not.exist');

        cy.getByCy('attack-preference-neutral').click();

        cy.getByCy('champion-card-Gambit').find('[data-cy="detested-badge"]').should('not.exist');
        cy.getByCy('champion-card-Gambit').find('[data-cy="detested-attacker-name"]').should('not.exist');
      });
    });
  });

  it('preferred attacker is set via the add form picker', () => {
    setupRosterUser('pref-form', 'CorvusPlayer').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'Corvus', 'Cosmic');

      cy.apiLogin(userData.user_id, 'roster');

      cy.contains('Add / Update a Champion').click();
      cy.getByCy('champion-search').type('Corvus');
      cy.getByCy('champion-selected-preview').should('exist');
      cy.slideTo('rarity', '7R2');

      // The form picker starts on Neutral
      cy.getByCy('attack-preference-neutral').should('have.attr', 'data-active');
      cy.getByCy('attack-preference-preferred').click();

      cy.getByCy('champion-submit').click();
      cy.contains('Corvus added / updated').should('be.visible');

      // Should show the yellow name
      cy.getByCy('preferred-attacker-name').scrollIntoView().should('be.visible');
    });
  });

  it('multiple champions can be preferred attackers simultaneously', () => {
    setupRosterUser('pref-multi', 'MultiPrefPlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'NickFuryM', 'Skill').then((c1) => {
        cy.apiLoadChampion(adminData.access_token, 'AegonM', 'Science').then((c2) => {
          cy.apiAddChampionToRoster(userData.access_token, accountId, c1[0].id, '7r2', {
            attack_preference: 'preferred',
          });
          cy.apiAddChampionToRoster(userData.access_token, accountId, c2[0].id, '7r3', {
            attack_preference: 'preferred',
          });

          cy.apiLogin(userData.user_id, 'roster');

          // Both should show the yellow name
          cy.getByCy('preferred-attacker-name').should('have.length', 2);
        });
      });
    });
  });

  it("a plain member's read-only view of another roster opens no champion dialog", () => {
    setupAllianceWithMember('pref-ro', 'Blade', 'Skill').then(({ allianceId }) => {
      setupUser('pref-ro-viewer').then((viewer) => {
        cy.apiCreateGameAccount(viewer.access_token, 'PrefRoViewer', true).then((acc) => {
          cy.apiForceJoinAlliance(acc.id, allianceId);
          cy.apiLogin(viewer.user_id, 'alliances');

          cy.getByCy('view-roster-pref-roMember').click();
          cy.getByCy('champion-card-Blade').should('be.visible').click();
          cy.getByCy('champion-dialog').should('not.exist');
          cy.getByCy('attack-preference-picker').should('not.exist');
        });
      });
    });
  });
});
