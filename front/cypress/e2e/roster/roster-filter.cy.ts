import { setupRosterUser } from '../../support/e2e';
import {
  capRosterRankAt7r1,
  expectNoResultsThenReset,
  expectRosterCards,
  filterRosterByName,
  raiseRosterMinSigTo100,
} from './roster-filter-helpers';

/**
 * Adds a champion to the roster via the Add/Update form.
 * Assumes the form dialog is already open.
 */
function addChampion(name: string, rarity: string, sig: number) {
  cy.getByCy('champion-search').type(name);
  cy.getByCy('champion-selected-preview').should('contain', name);
  cy.slideTo('rarity', rarity.toUpperCase());
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
  setupRosterUser('ui-filter', 'FilterPlayer').then(({ adminData, userData }) => {
    cy.apiLoadChampion(adminData.access_token, 'Hercules', 'Cosmic');
    cy.apiLoadChampion(adminData.access_token, 'Hyperion', 'Cosmic');
    cy.apiLoadChampion(adminData.access_token, 'Magik', 'Mystic');

    cy.apiLogin(userData.user_id, 'roster');

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
    seedMixedRoster();
  });

  it('shows the whole roster and total count with no filter', () => {
    expectRosterCards(['Hercules', 'Hyperion', 'Magik']);
    cy.getByCy('roster-filter-count').should('contain', '3 / 3');
  });

  it('filters by name', () => {
    filterRosterByName('Herc');
    expectRosterCards(['Hercules'], ['Hyperion', 'Magik']);
    cy.getByCy('roster-filter-count').should('contain', '1 / 3');
  });

  it('filters by rank (7r1)', () => {
    capRosterRankAt7r1();
    expectRosterCards(['Hyperion'], ['Hercules', 'Magik']);
  });

  it('filters by class (Mystic)', () => {
    cy.getByCy('roster-filter-class').click();
    cy.contains('Mystic').click();
    expectRosterCards(['Magik'], ['Hercules', 'Hyperion']);
  });

  it('filters by minimum signature (>= 100)', () => {
    raiseRosterMinSigTo100();
    expectRosterCards(['Hercules'], ['Hyperion', 'Magik']);
  });

  it('reset clears all active filters', () => {
    filterRosterByName('Herc');
    expectRosterCards([], ['Hyperion']);

    cy.getByCy('roster-filter-reset').click();
    expectRosterCards(['Hercules', 'Hyperion', 'Magik']);
  });

  it('shows a "no results" message (not the empty-roster message) when a filter hides everything', () => {
    filterRosterByName('Zzz');
    expectRosterCards([], ['Hercules']);
    expectNoResultsThenReset('Hercules');
  });
});
