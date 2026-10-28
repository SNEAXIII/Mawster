import { setupAdmin, setupAllianceWithMember } from '../../support/e2e';

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
    cy.getByCy('roster-filter-name').type('Herc');
    cy.getByCy('champion-card-Hercules').should('exist');
    cy.getByCy('champion-card-Spider-Man').should('not.exist');
    cy.getByCy('champion-card-Magik').should('not.exist');
    cy.getByCy('roster-filter-count').should('contain', '1 / 3');
  });

  it('filters by rank (7r1)', () => {
    cy.getByCy('roster-filter-rank').find('[role="slider"]').last().focus().type('{leftarrow}'.repeat(5));
    cy.getByCy('champion-card-Spider-Man').should('exist');
    cy.getByCy('champion-card-Hercules').should('not.exist');
    cy.getByCy('champion-card-Magik').should('not.exist');
  });

  it('filters by minimum signature (>= 100)', () => {
    cy.getByCy('roster-filter-sig').find('[role="slider"]').first().focus().type('{pageup}'.repeat(10));
    cy.getByCy('champion-card-Hercules').should('exist');
    cy.getByCy('champion-card-Spider-Man').should('not.exist');
    cy.getByCy('champion-card-Magik').should('not.exist');
  });

  it('shows "no results" when a filter hides everything, and reset restores the roster', () => {
    cy.getByCy('roster-filter-name').type('Zzz');
    cy.getByCy('roster-no-results').should('be.visible');
    cy.getByCy('roster-empty').should('not.exist');

    cy.getByCy('roster-filter-reset').click();
    cy.getByCy('champion-card-Hercules').should('exist');
    cy.getByCy('roster-no-results').should('not.exist');
    cy.getByCy('roster-filter-count').should('contain', '3 / 3');
  });

  it('clears the filters when the roster is reopened', () => {
    cy.getByCy('roster-filter-name').type('Herc');
    cy.getByCy('roster-filter-count').should('contain', '1 / 3');

    cy.get('body').type('{esc}');
    cy.getByCy('roster-filter-name').should('not.exist');
    cy.getByCy('view-roster-MRFMember').click();

    cy.getByCy('roster-filter-name').should('have.value', '');
    cy.getByCy('roster-filter-count').should('contain', '3 / 3');
  });
});
