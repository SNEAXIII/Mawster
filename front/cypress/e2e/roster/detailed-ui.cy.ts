import { setupRosterUser } from '../../support/e2e';

describe('Roster – Detailed UI', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Rarity picker
  // =========================================================================

  describe('Rarity picker', () => {
    it('adds a champion with a specific rarity and verifies it appears in the correct rarity group', () => {
      setupRosterUser('ui-rarity', 'RarityPlayer').then(({ adminData, userData }) => {
        cy.apiLoadChampion(adminData.access_token, 'Medusa', 'Cosmic');

        cy.uiLogin(userData.login);
        cy.navTo('roster');

        cy.contains('Add / Update a Champion').click();
        cy.getByCy('champion-search').type('Medusa');
        cy.getByCy('champion-result-Medusa').click();

        // Select 7★R3 rarity
        cy.getByCy('rarity-7r3').click();
        cy.getByCy('champion-submit').click();
        cy.contains('Medusa added / updated').should('be.visible');

        // Verify the champion appears inside the correct rarity group
        cy.getByCy('rarity-group-7r3').should('exist');
        cy.getByCy('rarity-group-7r3').contains('Medusa').should('be.visible');
      });
    });

    it('adding champions with different rarities places them in separate groups', () => {
      setupRosterUser('ui-rarity-groups', 'GroupsPlayer').then(({ adminData, userData }) => {
        cy.apiLoadChampion(adminData.access_token, 'Thor', 'Cosmic');
        cy.apiLoadChampion(adminData.access_token, 'Hulk', 'Science');

        cy.uiLogin(userData.login);
        cy.navTo('roster');

        // Add Thor at 7r4
        cy.contains('Add / Update a Champion').click();
        cy.getByCy('champion-search').type('Thor');
        cy.getByCy('champion-result-Thor').click();
        cy.getByCy('rarity-7r4').click();
        cy.getByCy('champion-submit').click();
        cy.contains('Thor added / updated').should('be.visible');

        // Add Hulk at 6r5
        cy.getByCy('champion-search').type('Hulk');
        cy.getByCy('champion-result-Hulk').click();
        cy.getByCy('rarity-6r5').click();
        cy.getByCy('champion-submit').click();
        cy.contains('Hulk added / updated').should('be.visible');

        // Thor in 7r4 group, Hulk in 6r5 group
        cy.getByCy('rarity-group-7r4').find('[data-cy="champion-card-Thor"]').should('exist');
        cy.getByCy('rarity-group-6r5').find('[data-cy="champion-card-Hulk"]').should('exist');

        // Cross-check: Thor NOT in 6r5, Hulk NOT in 7r4
        cy.getByCy('rarity-group-6r5').find('[data-cy="champion-card-Thor"]').should('not.exist');
        cy.getByCy('rarity-group-7r4').find('[data-cy="champion-card-Hulk"]').should('not.exist');
      });
    });

    it('selected rarity button is visually highlighted', () => {
      setupRosterUser('ui-rarity-highlight', 'HighlightPlayer').then(({ adminData, userData }) => {
        cy.apiLoadChampion(adminData.access_token, 'Venom', 'Cosmic');

        cy.uiLogin(userData.login);
        cy.navTo('roster');

        cy.contains('Add / Update a Champion').click();
        cy.getByCy('champion-search').type('Venom');
        cy.getByCy('champion-result-Venom').click();

        // Click 7r2 and verify it gets the active state
        cy.getByCy('rarity-7r2').click();
        cy.getByCy('rarity-7r2').should('have.attr', 'data-state', 'on');

        // Click 7r5 instead — previous should lose active, new should gain it
        cy.getByCy('rarity-7r5').click();
        cy.getByCy('rarity-7r5').should('have.attr', 'data-state', 'on');
        cy.getByCy('rarity-7r2').should('have.attr', 'data-state', 'off');
      });
    });
  });

  // =========================================================================
  // Signature
  // =========================================================================

  describe('Signature', () => {
    it('sets signature via preset buttons and verifies it on the card', () => {
      setupRosterUser('ui-sig-preset', 'SigPresetPlayer').then(({ adminData, userData }) => {
        cy.apiLoadChampion(adminData.access_token, 'DoctorVoodoo', 'Mystic');

        cy.uiLogin(userData.login);
        cy.navTo('roster');

        cy.contains('Add / Update a Champion').click();
        cy.getByCy('champion-search').type('DoctorVoodoo');
        cy.getByCy('champion-result-DoctorVoodoo').click();
        cy.getByCy('rarity-7r2').click();

        // Click the 200 preset button
        cy.contains('button', '200').click();
        // Verify the input field shows 200
        cy.getByCy('sig-input').should('have.value', '200');

        cy.getByCy('champion-submit').click();
        cy.contains('DoctorVoodoo added / updated').should('be.visible');

        // Verify sig 200 is displayed on the card
        cy.getByCy('champion-card-DoctorVoodoo').find('[data-cy="champion-sig"]').should('contain', 'sig 200');
      });
    });

    it('sets signature via manual input and verifies it on the card', () => {
      setupRosterUser('ui-sig-manual', 'SigManualPlayer').then(({ adminData, userData }) => {
        cy.apiLoadChampion(adminData.access_token, 'Magik', 'Mystic');

        cy.uiLogin(userData.login);
        cy.navTo('roster');

        cy.contains('Add / Update a Champion').click();
        cy.getByCy('champion-search').type('Magik');
        cy.getByCy('champion-result-Magik').click();
        cy.getByCy('rarity-6r4').click();

        // Select all and type custom value
        cy.getByCy('sig-input').type('{selectall}150');
        cy.getByCy('sig-input').should('have.value', '150');

        cy.getByCy('champion-submit').click();
        cy.contains('Magik added / updated').should('be.visible');

        // Verify sig 150 on the card
        cy.getByCy('champion-card-Magik').find('[data-cy="champion-sig"]').should('contain', 'sig 150');
      });
    });

    it('champion with sig 0 shows dim sig on the card', () => {
      setupRosterUser('ui-sig-zero', 'SigZeroPlayer').then(({ adminData, userData }) => {
        cy.apiLoadChampion(adminData.access_token, 'Phoenix', 'Cosmic');

        cy.uiLogin(userData.login);
        cy.navTo('roster');

        cy.contains('Add / Update a Champion').click();
        cy.getByCy('champion-search').type('Phoenix');
        cy.getByCy('champion-result-Phoenix').click();
        cy.getByCy('rarity-7r1').click();
        // Sig defaults to 0 — just submit
        cy.getByCy('champion-submit').click();
        cy.contains('Phoenix added / updated').should('be.visible');

        // Card should show "sig 0" with the dim style (text-white/50)
        cy.getByCy('champion-card-Phoenix')
          .find('[data-cy="champion-sig"]')
          .should('contain', 'sig 0')
          .and('have.class', 'text-white/50');
      });
    });
  });

  // =========================================================================
  // Ascension
  // =========================================================================

  describe('Ascension', () => {
    it('adds an ascendable champion with A1 and verifies the ascension badge on the card', () => {
      setupRosterUser('ui-asc-a1', 'AscA1Player').then(({ adminData, userData }) => {
        // Load champion with is_ascendable = true
        cy.apiLoadChampion(adminData.access_token, 'AscHero', 'Mutant', { is_ascendable: true });

        cy.uiLogin(userData.login);
        cy.navTo('roster');

        cy.contains('Add / Update a Champion').click();
        cy.getByCy('champion-search').type('AscHero');
        cy.getByCy('champion-result-AscHero').click();
        cy.getByCy('rarity-7r3').click();

        // Ascension buttons should be enabled for ascendable champion
        cy.getByCy('ascension-1').should('not.be.disabled');
        cy.getByCy('ascension-2').should('not.be.disabled');

        // Select A1
        cy.getByCy('ascension-1').click();
        cy.getByCy('ascension-1').should('have.attr', 'data-state', 'on');

        cy.getByCy('champion-submit').click();
        cy.contains('AscHero added / updated').should('be.visible');

        // Verify ascension badge "· A1" is shown on the card
        cy.getByCy('champion-card-AscHero').find('[data-cy="champion-ascension"]').should('exist').and('contain', 'A1');
      });
    });

    it('adds an ascendable champion with A2 and verifies the ascension badge', () => {
      setupRosterUser('ui-asc-a2', 'AscA2Player').then(({ adminData, userData }) => {
        cy.apiLoadChampion(adminData.access_token, 'AscHeroMax', 'Science', {
          is_ascendable: true,
        });

        cy.uiLogin(userData.login);
        cy.navTo('roster');

        cy.contains('Add / Update a Champion').click();
        cy.getByCy('champion-search').type('AscHeroMax');
        cy.getByCy('champion-result-AscHeroMax').click();
        cy.getByCy('rarity-7r4').click();

        // Select A2
        cy.getByCy('ascension-2').click();
        cy.getByCy('ascension-2').should('have.attr', 'data-state', 'on');

        cy.getByCy('champion-submit').click();
        cy.contains('AscHeroMax added / updated').should('be.visible');

        // Verify ascension badge "· A2"
        cy.getByCy('champion-card-AscHeroMax')
          .find('[data-cy="champion-ascension"]')
          .should('exist')
          .and('contain', 'A2');
      });
    });

    it('disables ascension buttons for non-ascendable champions', () => {
      setupRosterUser('ui-asc-disabled', 'NoAscPlayer').then(({ adminData, userData }) => {
        // Load champion without is_ascendable (default false)
        cy.apiLoadChampion(adminData.access_token, 'NoAscChamp', 'Tech');

        cy.uiLogin(userData.login);
        cy.navTo('roster');

        cy.contains('Add / Update a Champion').click();
        cy.getByCy('champion-search').type('NoAscChamp');
        cy.getByCy('champion-result-NoAscChamp').click();

        // A1 and A2 buttons should be disabled
        cy.getByCy('ascension-1').should('be.disabled');
        cy.getByCy('ascension-2').should('be.disabled');
        // None button should still be enabled and selected
        cy.getByCy('ascension-0').should('not.be.disabled');

        // Message "This champion cannot be ascended." should appear
        cy.contains('This champion cannot be ascended.').should('be.visible');
      });
    });

    it('ascends a champion via card button and verifies badge appears', () => {
      setupRosterUser('ui-asc-card', 'AscCardPlayer').then(({ adminData, userData, accountId }) => {
        cy.apiLoadChampion(adminData.access_token, 'AscCardHero', 'Mystic', {
          is_ascendable: true,
        }).then((champs) => {
          // Add with ascension 0 via API
          cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r2', {
            ascension: 0,
          });

          cy.uiLogin(userData.login);
          cy.navTo('roster');

          // No ascension badge initially
          cy.getByCy('champion-ascension').should('not.exist');

          // Click ascend button (FiStar) on the card via title attribute
          cy.getByCy('champion-card-AscCardHero').find('[title="Ascension"]').click({ force: true });

          // Confirm ascension in dialog
          cy.get('[role="alertdialog"]').should('be.visible');
          cy.get('[role="alertdialog"]').contains('button', 'Ascend').click();

          // Ascension badge should now show A1
          cy.getByCy('champion-card-AscCardHero')
            .find('[data-cy="champion-ascension"]')
            .should('exist')
            .and('contain', 'A1');
        });
      });
    });
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
        cy.getByCy('champion-card-Omega').find('[data-cy="champion-sig"]').should('exist').and('contain', 'sig 200');

        // Ascension A2
        cy.getByCy('champion-card-Omega').find('[data-cy="champion-ascension"]').should('exist').and('contain', 'A2');
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
      setupRosterUser('ui-edit-update', 'EditUpdPlayer').then(({ adminData, userData, accountId }) => {
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
          cy.getByCy('champion-card-EditUpd').find('[data-cy="champion-sig"]').should('contain', 'sig 200');
          cy.getByCy('champion-card-EditUpd').find('[data-cy="champion-ascension"]').should('contain', 'A1');
        });
      });
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
        cy.getByCy('champion-card-Kingpin').find('[data-cy="champion-sig"]').should('contain', 'sig 200');
      });
    });
  });
});
