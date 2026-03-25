import { setupRosterUser } from '../../support/e2e';

describe('Roster – Rarity & Signature', () => {
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
});
