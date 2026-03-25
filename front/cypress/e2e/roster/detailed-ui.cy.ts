import { setupRosterUser } from '../../support/e2e';

describe('Roster – Detailed UI (Combined, Edit, Already-in-Roster)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Combined test
  // =========================================================================

  describe('Combined', () => {
    it('adds a champion with rarity + signature + preferred attacker + ascension and verifies all visual elements', () => {
      setupRosterUser('ui-combined', 'CombinedPlayer').then(({ adminData, userData }) => {
        cy.apiLoadChampion(adminData.access_token, 'Omega', 'Mutant', { is_ascendable: true });

        cy.uiLogin(userData.login);
        cy.navTo('roster');

        cy.contains('Add / Update a Champion').click();
        cy.getByCy('champion-search').type('Omega');
        cy.getByCy('champion-result-Omega').click();

        // Set rarity 7r5
        cy.getByCy('rarity-7r5').click();

        // Set signature to 200
        cy.contains('button', '200').click();
        cy.getByCy('sig-input').should('have.value', '200');

        // Check preferred attacker
        cy.getByCy('preferred-attacker-checkbox').click({ force: true });

        // Set ascension A2
        cy.getByCy('ascension-2').click();

        cy.getByCy('champion-submit').click();
        cy.contains('Omega added / updated').should('be.visible');

        // Verify rarity group
        cy.getByCy('rarity-group-7r5').find('[data-cy="champion-card-Omega"]').should('exist');

        // Preferred attacker: yellow name with ⚔
        cy.getByCy('champion-card-Omega')
          .find('[data-cy="preferred-attacker-name"]')
          .should('exist')
          .and('have.class', 'text-yellow-400')
          .and('contain', '⚔');

        // Signature 200
        cy.getByCy('champion-card-Omega')
          .find('[data-cy="champion-sig"]')
          .should('exist')
          .and('contain', 'sig 200');

        // Ascension A2
        cy.getByCy('champion-card-Omega')
          .find('[data-cy="champion-ascension"]')
          .should('exist')
          .and('contain', 'A2');
      });
    });
  });

  // =========================================================================
  // Edit button (pre-fill form)
  // =========================================================================

  describe('Edit button', () => {
    it('clicking edit pre-fills the form with champion info', () => {
      setupRosterUser('ui-edit', 'EditPlayer').then(({ adminData, userData, accountId }) => {
        cy.apiLoadChampion(adminData.access_token, 'EditHero', 'Tech', {
          is_ascendable: true,
        }).then((champs) => {
          // Add champion with specific values via API
          cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r3', {
            signature: 120,
            ascension: 1,
            is_preferred_attacker: true,
          });

          cy.uiLogin(userData.login);
          cy.navTo('roster');

          // Click the edit button on the champion card
          cy.getByCy('champion-edit').first().click({ force: true });

          // Form should be open and pre-filled
          cy.contains('EditHero').should('be.visible');

          // Rarity 7r3 should be selected (active state)
          cy.getByCy('rarity-7r3').should('have.attr', 'data-state', 'on');

          // Signature input should show 120
          cy.getByCy('sig-input').should('have.value', '120');

          // Ascension A1 should be selected
          cy.getByCy('ascension-1').should('have.attr', 'data-state', 'on');
        });
      });
    });

    it('editing and re-submitting updates the champion in the roster', () => {
      setupRosterUser('ui-edit-update', 'EditUpdPlayer').then(
        ({ adminData, userData, accountId }) => {
          cy.apiLoadChampion(adminData.access_token, 'EditUpd', 'Skill', {
            is_ascendable: true,
          }).then((champs) => {
            cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r2', {
              signature: 50,
              ascension: 0,
            });

            cy.uiLogin(userData.login);
            cy.navTo('roster');

            // Click edit
            cy.getByCy('champion-edit').first().click({ force: true });

            // Change rarity to 7r4
            cy.getByCy('rarity-7r4').click();

            // Change signature to 200
            cy.getByCy('sig-input').clear().type('200');

            // Set ascension to A1
            cy.getByCy('ascension-1').click();

            // Submit update
            cy.getByCy('champion-submit').click();
            cy.contains('EditUpd added / updated').should('be.visible');

            // Verify updated values on the card
            cy.getByCy('rarity-group-7r4').contains('EditUpd').should('be.visible');
            cy.getByCy('champion-card-EditUpd')
              .find('[data-cy="champion-sig"]')
              .should('contain', 'sig 200');
            cy.getByCy('champion-card-EditUpd')
              .find('[data-cy="champion-ascension"]')
              .should('contain', 'A1');
          });
        }
      );
    });
  });

  // =========================================================================
  // Already in roster indicator
  // =========================================================================

  describe('Already in roster indicator', () => {
    it('shows existing entry info when selecting a champion already in the roster', () => {
      setupRosterUser('ui-already', 'AlreadyPlayer').then(({ adminData, userData, accountId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Doom', 'Mystic').then((champs) => {
          // Add champion with sig 200 at 7r3
          cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r3', {
            signature: 200,
          });

          cy.uiLogin(userData.login);
          cy.navTo('roster');

          // Open form and search for the same champion
          cy.contains('Add / Update a Champion').click();
          cy.getByCy('champion-search').type('Doom');
          cy.getByCy('champion-result-Doom').click();

          // "Already in roster" indicator should appear
          cy.getByCy('already-in-roster').should('be.visible');
          cy.getByCy('already-in-roster').should('contain', 'Already in roster:');
          // Should show the existing rarity and signature
          cy.getByCy('already-in-roster').should('contain', '7★R3');
          cy.getByCy('already-in-roster').should('contain', 'sig 200');
        });
      });
    });

    it("adding same champion twice shows 'already in roster' and updates instead of duplicating", () => {
      setupRosterUser('ui-already-dup', 'AlreadyDupPlayer').then(({ adminData, userData }) => {
        cy.apiLoadChampion(adminData.access_token, 'Kingpin', 'Skill');

        cy.uiLogin(userData.login);
        cy.navTo('roster');

        // Add Kingpin at 7r1 with sig 20
        cy.contains('Add / Update a Champion').click();
        cy.getByCy('champion-search').type('Kingpin');
        cy.getByCy('champion-result-Kingpin').click();
        cy.getByCy('rarity-7r1').click();
        cy.contains('button', '20').click();
        cy.getByCy('champion-submit').click();
        cy.contains('Kingpin added / updated').should('be.visible');

        // Now search for same champion again
        cy.getByCy('champion-search').type('Kingpin');
        cy.getByCy('champion-result-Kingpin').click();

        // "Already in roster" indicator should appear with previous entry info
        cy.getByCy('already-in-roster').should('be.visible');
        cy.getByCy('already-in-roster').should('contain', 'sig 20');

        // Update with different rarity and sig
        cy.getByCy('rarity-7r2').click();
        cy.contains('button', '200').click();
        cy.getByCy('champion-submit').click();
        cy.contains('Kingpin added / updated').should('be.visible');

        // Should only appear once (updated, not duplicated)
        cy.get('[data-cy="champion-delete"]').should('have.length', 1);
        // Should now be in the 7r2 group
        cy.getByCy('rarity-group-7r2').contains('Kingpin').should('be.visible');
        cy.getByCy('champion-card-Kingpin')
          .find('[data-cy="champion-sig"]')
          .should('contain', 'sig 200');
      });
    });
  });
});
