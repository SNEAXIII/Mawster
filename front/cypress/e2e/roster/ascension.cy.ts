import { setupRosterUser } from '../../support/e2e';

describe('Roster – Ascension', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('adds an ascendable champion with A1 and verifies the ascension badge on the card', () => {
    setupRosterUser('ui-asc-a1', 'AscA1Player').then(({ adminData, userData }) => {
      // Load champion with is_ascendable = true
      cy.apiLoadChampion(adminData.access_token, 'AscHero', 'Mutant', { is_ascendable: true });

      cy.apiLogin(userData.user_id, 'roster');

      cy.contains('Add / Update a Champion').click();
      cy.getByCy('champion-search').type('AscHero');
      cy.getByCy('champion-submit').should('not.be.disabled');
      cy.slideTo('rarity', '7R3');

      // Ascension slider should be enabled for ascendable champion
      cy.getByCy('ascension').find('[role="slider"]').should('not.have.attr', 'data-disabled');

      // Select A1
      cy.slideTo('ascension', 'A1');
      cy.getByCy('ascension-value').should('have.text', 'A1');

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

      cy.apiLogin(userData.user_id, 'roster');

      cy.contains('Add / Update a Champion').click();
      cy.getByCy('champion-search').type('AscHeroMax');
      cy.getByCy('champion-submit').should('not.be.disabled');
      cy.slideTo('rarity', '7R4');

      // Select A2
      cy.slideTo('ascension', 'A2');
      cy.getByCy('ascension-value').should('have.text', 'A2');

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

      cy.apiLogin(userData.user_id, 'roster');

      cy.contains('Add / Update a Champion').click();
      cy.getByCy('champion-search').type('NoAscChamp');
      cy.getByCy('champion-submit').should('not.be.disabled');

      // Ascension slider should be locked on None
      cy.getByCy('ascension').find('[role="slider"]').should('have.attr', 'data-disabled');
      cy.getByCy('ascension-value').should('have.text', 'None');

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

        cy.apiLogin(userData.user_id, 'roster');

        // No ascension badge initially
        cy.getByCy('champion-ascension').should('not.exist');

        // Click ascend button (FiStar) on the card via title attribute
        cy.getByCy('champion-card-AscCardHero').find('[title="Ascension"]').focus().click();

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
