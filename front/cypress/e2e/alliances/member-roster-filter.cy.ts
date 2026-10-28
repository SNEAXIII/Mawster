import { setupAdmin, setupAllianceWithMember } from '../../support/e2e';
import {
  capRosterRankAt7r1,
  expectNoResultsThenReset,
  expectRosterCards,
  filterRosterByName,
  raiseRosterMinSigTo100,
} from '../roster/roster-filter-helpers';

/**
 * Owner opens the member's roster preview, seeded with:
 *   - Spider-Man (Science) 7r1 sig 0   → from setupAllianceWithMember
 *   - Hercules   (Cosmic)  7r5 sig 200
 *   - Magik      (Mystic)  7r5 sig 0
 */
function openSeededMemberRoster() {
  setupAllianceWithMember('MRF', 'Spider-Man', 'Science').then(({ ownerData, memberData, memberAccId }) => {
    setupAdmin('MRF-admin-extra').then(({ access_token }) => {
      cy.apiLoadChampion(access_token, 'Hercules', 'Cosmic').then((champs) => {
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r5', { signature: 200 });
      });
      cy.apiLoadChampion(access_token, 'Magik', 'Mystic').then((champs) => {
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r5');
      });
    });

    cy.apiLogin(ownerData.user_id, 'alliances');
    cy.getByCy('view-roster-MRFMember').click();
    cy.getByCy('roster-filter-count').should('contain', '3 / 3');
  });
}

describe('Alliance – Member roster preview filters', () => {
  beforeEach(() => {
    cy.truncateDb();
    openSeededMemberRoster();
  });

  it('filters by name', () => {
    filterRosterByName('Herc');
    expectRosterCards(['Hercules'], ['Spider-Man', 'Magik']);
    cy.getByCy('roster-filter-count').should('contain', '1 / 3');
  });

  it('filters by rank (7r1)', () => {
    capRosterRankAt7r1();
    expectRosterCards(['Spider-Man'], ['Hercules', 'Magik']);
  });

  it('filters by minimum signature (>= 100)', () => {
    raiseRosterMinSigTo100();
    expectRosterCards(['Hercules'], ['Spider-Man', 'Magik']);
  });

  it('shows "no results" when a filter hides everything, and reset restores the roster', () => {
    filterRosterByName('Zzz');
    expectNoResultsThenReset('Hercules');
    cy.getByCy('roster-filter-count').should('contain', '3 / 3');
  });

  it('clears the filters when the roster is reopened', () => {
    filterRosterByName('Herc');
    cy.getByCy('roster-filter-count').should('contain', '1 / 3');

    cy.get('body').type('{esc}');
    cy.getByCy('roster-filter-name').should('not.exist');
    cy.getByCy('view-roster-MRFMember').click();

    cy.getByCy('roster-filter-name').should('have.value', '');
    cy.getByCy('roster-filter-count').should('contain', '3 / 3');
  });
});
