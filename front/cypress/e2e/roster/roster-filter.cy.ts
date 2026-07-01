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

/**
 * Seeds a mixed roster and lands on the roster tab:
 *   - Hercules (Cosmic) 7r5 sig 200  → awakened, high sig
 *   - Hyperion (Cosmic) 7r1 sig 0
 *   - Magik    (Mystic) 7r5 sig 0
 */
function seedMixedRoster() {
  return setupRosterUser('ui-filter', 'FilterPlayer').then(({ adminData, userData }) => {
    cy.apiLoadChampion(adminData.access_token, 'Hercules', 'Cosmic');
    cy.apiLoadChampion(adminData.access_token, 'Hyperion', 'Cosmic');
    cy.apiLoadChampion(adminData.access_token, 'Magik', 'Mystic');

    cy.apiLogin(userData.user_id);
    cy.navTo('roster');

    cy.contains('Add / Update a Champion').click();
    addChampion('Hercules', '7r5', 200);
    addChampion('Hyperion', '7r1', 0);
    addChampion('Magik', '7r5', 0);
    cy.get('body').type('{esc}'); // close the dialog
  });
}

describe('Roster – Filter bar', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows the whole roster and total count with no filter', () => {
    seedMixedRoster().then(() => {
      cy.getByCy('champion-card-Hercules').should('exist');
      cy.getByCy('champion-card-Hyperion').should('exist');
      cy.getByCy('champion-card-Magik').should('exist');
      cy.getByCy('roster-filter-count').should('contain', '3 / 3');
    });
  });

  it('filters by name', () => {
    seedMixedRoster().then(() => {
      cy.getByCy('roster-filter-name').type('Herc');
      cy.getByCy('champion-card-Hercules').should('exist');
      cy.getByCy('champion-card-Hyperion').should('not.exist');
      cy.getByCy('champion-card-Magik').should('not.exist');
      cy.getByCy('roster-filter-count').should('contain', '1 / 3');
    });
  });

  it('filters by rank (7r1)', () => {
    seedMixedRoster().then(() => {
      cy.getByCy('roster-filter-rank-7r1').click();
      cy.getByCy('champion-card-Hyperion').should('exist');
      cy.getByCy('champion-card-Hercules').should('not.exist');
      cy.getByCy('champion-card-Magik').should('not.exist');
    });
  });

  it('filters by class (Mystic)', () => {
    seedMixedRoster().then(() => {
      cy.getByCy('roster-filter-class').click();
      cy.contains('Mystic').click();
      cy.getByCy('champion-card-Magik').should('exist');
      cy.getByCy('champion-card-Hercules').should('not.exist');
      cy.getByCy('champion-card-Hyperion').should('not.exist');
    });
  });

  it('filters by awakened (sig > 0)', () => {
    seedMixedRoster().then(() => {
      cy.getByCy('roster-filter-awakened').click();
      cy.getByCy('champion-card-Hercules').should('exist');
      cy.getByCy('champion-card-Hyperion').should('not.exist');
      cy.getByCy('champion-card-Magik').should('not.exist');
    });
  });

  it('filters by minimum signature (>= 100)', () => {
    seedMixedRoster().then(() => {
      cy.getByCy('roster-filter-min-sig').type('{selectall}100');
      cy.getByCy('champion-card-Hercules').should('exist');
      cy.getByCy('champion-card-Hyperion').should('not.exist');
      cy.getByCy('champion-card-Magik').should('not.exist');
    });
  });

  it('reset clears all active filters', () => {
    seedMixedRoster().then(() => {
      cy.getByCy('roster-filter-name').type('Herc');
      cy.getByCy('champion-card-Hyperion').should('not.exist');

      cy.getByCy('roster-filter-reset').click();
      cy.getByCy('champion-card-Hercules').should('exist');
      cy.getByCy('champion-card-Hyperion').should('exist');
      cy.getByCy('champion-card-Magik').should('exist');
    });
  });

  it('shows a "no results" message (not the empty-roster message) when a filter hides everything', () => {
    seedMixedRoster().then(() => {
      cy.getByCy('roster-filter-name').type('Zzz');
      cy.getByCy('champion-card-Hercules').should('not.exist');
      cy.getByCy('roster-no-results').should('be.visible');
      cy.getByCy('roster-empty').should('not.exist');

      cy.getByCy('roster-filter-reset').click();
      cy.getByCy('champion-card-Hercules').should('exist');
      cy.getByCy('roster-no-results').should('not.exist');
    });
  });
});
