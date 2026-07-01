import { setupRosterUser } from '../../support/e2e';

/**
 * Adds a champion to the roster via the Add/Update form.
 * Assumes the form dialog is already open.
 */
function addChampion(name: string, rarity: string, sig: number) {
  cy.getByCy('champion-search').type(name);
  cy.getByCy('champion-selected-preview').should('contain', name);
  cy.getByCy(`rarity-${rarity}`).click();
  cy.getByCy('sig-input').type(`{selectall}${sig}`);
  cy.getByCy('champion-submit').click();
  cy.contains(`${name} added / updated`).scrollIntoView().should('be.visible');
}

describe('Roster – Filter bar', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('filters by name, rank, class, awakened, min-sig and resets', () => {
    setupRosterUser('ui-filter', 'FilterPlayer').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'Hercules', 'Cosmic');
      cy.apiLoadChampion(adminData.access_token, 'Hyperion', 'Cosmic');
      cy.apiLoadChampion(adminData.access_token, 'Magik', 'Mystic');

      cy.apiLogin(userData.user_id);
      cy.navTo('roster');

      // --- Seed a mixed roster ---
      cy.contains('Add / Update a Champion').click();
      addChampion('Hercules', '7r5', 200);
      addChampion('Hyperion', '7r1', 0);
      addChampion('Magik', '7r5', 0);
      cy.get('body').type('{esc}'); // close the dialog

      // All three present, count reflects total
      cy.getByCy('champion-card-Hercules').should('exist');
      cy.getByCy('champion-card-Hyperion').should('exist');
      cy.getByCy('champion-card-Magik').should('exist');
      cy.getByCy('roster-filter-count').should('contain', '3 / 3');

      // --- Name filter ---
      cy.getByCy('roster-filter-name').type('Herc');
      cy.getByCy('champion-card-Hercules').should('exist');
      cy.getByCy('champion-card-Hyperion').should('not.exist');
      cy.getByCy('roster-filter-count').should('contain', '1 / 3');
      cy.getByCy('roster-filter-name').clear();

      // --- Rank filter (7r1 only → only Hyperion) ---
      cy.getByCy('roster-filter-rank-7r1').click();
      cy.getByCy('champion-card-Hyperion').should('exist');
      cy.getByCy('champion-card-Hercules').should('not.exist');
      cy.getByCy('champion-card-Magik').should('not.exist');
      cy.getByCy('roster-filter-rank-7r1').click(); // unset

      // --- Class filter (Mystic → only Magik) ---
      cy.getByCy('roster-filter-class').click();
      cy.contains('Mystic').click();
      cy.getByCy('champion-card-Magik').should('exist');
      cy.getByCy('champion-card-Hercules').should('not.exist');
      // reset class to all via the reset button below

      // --- Reset clears everything ---
      cy.getByCy('roster-filter-reset').click();
      cy.getByCy('champion-card-Hercules').should('exist');
      cy.getByCy('champion-card-Hyperion').should('exist');
      cy.getByCy('champion-card-Magik').should('exist');

      // --- Awakened toggle (sig > 0 → only Hercules) ---
      cy.getByCy('roster-filter-awakened').click();
      cy.getByCy('champion-card-Hercules').should('exist');
      cy.getByCy('champion-card-Hyperion').should('not.exist');
      cy.getByCy('champion-card-Magik').should('not.exist');
      cy.getByCy('roster-filter-awakened').click(); // unset

      // --- Min-signature filter (>= 100 → only Hercules) ---
      cy.getByCy('roster-filter-min-sig').type('{selectall}100');
      cy.getByCy('champion-card-Hercules').should('exist');
      cy.getByCy('champion-card-Hyperion').should('not.exist');
      cy.getByCy('champion-card-Magik').should('not.exist');
    });
  });

  it('shows a "no results" message (not the empty-roster message) when a filter hides everything', () => {
    setupRosterUser('ui-filter-empty', 'FilterEmptyPlayer').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'Hercules', 'Cosmic');

      cy.apiLogin(userData.user_id);
      cy.navTo('roster');

      cy.contains('Add / Update a Champion').click();
      addChampion('Hercules', '7r5', 200);
      cy.get('body').type('{esc}'); // close the dialog

      cy.getByCy('champion-card-Hercules').should('exist');

      // Filter to a name that matches nothing
      cy.getByCy('roster-filter-name').type('Zzz');
      cy.getByCy('champion-card-Hercules').should('not.exist');
      cy.getByCy('roster-no-results').should('be.visible');
      cy.getByCy('roster-empty').should('not.exist');

      // Clearing the filter brings the champion back
      cy.getByCy('roster-filter-reset').click();
      cy.getByCy('champion-card-Hercules').should('exist');
      cy.getByCy('roster-no-results').should('not.exist');
    });
  });
});
