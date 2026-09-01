import { setupRosterUser } from '../../support/e2e';

describe('Roster – Rarity & Signature', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // Load the champions the test needs, land on the roster and open the add form.
  function openAddChampionForm(prefix: string, pseudo: string, champions: Array<[string, string]>) {
    return setupRosterUser(prefix, pseudo).then(({ adminData, userData }) => {
      champions.forEach(([name, cls]) => cy.apiLoadChampion(adminData.access_token, name, cls));
      cy.apiLogin(userData.user_id, 'roster');
      cy.contains('Add / Update a Champion').click();
    });
  }

  function pickChampion(name: string) {
    cy.getByCy('champion-search').type(name);
    cy.getByCy('champion-selected-preview').should('contain', name);
  }

  function submitChampion(name: string) {
    cy.getByCy('champion-submit').click();
    cy.contains(`${name} added / updated`).scrollIntoView().should('be.visible');
  }

  // =========================================================================
  // Rarity picker
  // =========================================================================

  describe('Rarity picker', () => {
    it('adds a champion with a specific rarity and verifies it appears in the correct rarity group', () => {
      openAddChampionForm('ui-rarity', 'RarityPlayer', [['Medusa', 'Cosmic']]).then(() => {
        pickChampion('Medusa');

        // Select 7R3 rarity
        cy.getByCy('rarity-7r3').click();
        submitChampion('Medusa');

        // Verify the champion appears inside the correct rarity group
        cy.getByCy('rarity-group-7r3').should('exist');
        cy.getByCy('rarity-group-7r3').contains('Medusa').scrollIntoView().should('be.visible');
      });
    });

    it('adding champions with different rarities places them in separate groups', () => {
      openAddChampionForm('ui-rarity-groups', 'GroupsPlayer', [
        ['Thor', 'Cosmic'],
        ['Hulk', 'Science'],
      ]).then(() => {
        // Add Thor at 7r4
        pickChampion('Thor');
        cy.getByCy('rarity-7r4').click();
        submitChampion('Thor');

        // Add Hulk at 6r5 — the form stays open after a submit
        pickChampion('Hulk');
        cy.getByCy('rarity-6r5').click();
        submitChampion('Hulk');

        // Thor in 7r4 group, Hulk in 6r5 group
        cy.getByCy('rarity-group-7r4').find('[data-cy="champion-card-Thor"]').should('exist');
        cy.getByCy('rarity-group-6r5').find('[data-cy="champion-card-Hulk"]').should('exist');

        // Cross-check: Thor NOT in 6r5, Hulk NOT in 7r4
        cy.getByCy('rarity-group-6r5').find('[data-cy="champion-card-Thor"]').should('not.exist');
        cy.getByCy('rarity-group-7r4').find('[data-cy="champion-card-Hulk"]').should('not.exist');
      });
    });

    it('selected rarity button is visually highlighted', () => {
      openAddChampionForm('ui-rarity-highlight', 'HighlightPlayer', [['Venom', 'Cosmic']]).then(() => {
        pickChampion('Venom');

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
      openAddChampionForm('ui-sig-preset', 'SigPresetPlayer', [['DoctorVoodoo', 'Mystic']]).then(() => {
        pickChampion('DoctorVoodoo');
        cy.getByCy('rarity-7r2').click();

        // Click the 200 preset button
        cy.contains('button', '200').click();
        // Verify the input field shows 200
        cy.getByCy('sig-input').should('have.value', '200');

        submitChampion('DoctorVoodoo');

        // Verify the signature value is displayed on the card
        cy.getByCy('champion-card-DoctorVoodoo').find('[data-cy="champion-sig"]').should('contain', '200');
      });
    });

    it('sets signature via manual input and verifies it on the card', () => {
      openAddChampionForm('ui-sig-manual', 'SigManualPlayer', [['Magik', 'Mystic']]).then(() => {
        pickChampion('Magik');
        cy.getByCy('rarity-6r4').click();

        // Select all and type custom value
        cy.getByCy('sig-input').type('{selectall}150');
        cy.getByCy('sig-input').should('have.value', '150');

        submitChampion('Magik');

        // Verify the signature value on the card
        cy.getByCy('champion-card-Magik').find('[data-cy="champion-sig"]').should('contain', '150');
      });
    });

    it('champion with sig 0 shows dim sig on the card', () => {
      openAddChampionForm('ui-sig-zero', 'SigZeroPlayer', [['Phoenix', 'Cosmic']]).then(() => {
        pickChampion('Phoenix');
        cy.getByCy('rarity-7r1').click();
        // Sig defaults to 0 — just submit
        submitChampion('Phoenix');

        // Card should show a dim "0" signature
        cy.getByCy('champion-card-Phoenix')
          .find('[data-cy="champion-sig"]')
          .should('contain', '0')
          .and('have.class', 'text-muted-foreground');
      });
    });
  });
});
