import { addStatsForPlayer, closeSeason, openStatsAs, withWarScenario } from './statistics-helpers';

// The Statistics tab shows the "display season": the active season if one exists,
// otherwise the most recent ended season. During pre-season (a season has been
// closed and none is active) it must fall back to that ended season's stats and
// surface a badge naming it. When a season is active, no badge is shown.
describe('Alliance Statistics – Pre-season (ended-season fallback + badge)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows previous ended-season stats and the season badge during pre-season', () => {
    withWarScenario('stat-pre', 'Enemy').then(
      ({ adminToken, ownerToken, ownerUserId, allianceId, champId, cuId, warId, seasonIds }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        // Enter pre-season: close season 64 (active -> ended); no active season remains.
        closeSeason(adminToken, seasonIds['64']);

        openStatsAs(ownerUserId);

        // Stats from the ended season are still shown (not empty).
        cy.getByCy('statistics-table').should('be.visible');
        cy.getByCy('statistics-table').find('tbody tr').should('have.length', 1);
        // Badge names the ended season being displayed.
        cy.getByCy('statistics-season-badge').should('be.visible').and('contain', '64');
      },
    );
  });

  it('does not show the season badge while a season is active', () => {
    withWarScenario('stat-actbadge', 'Enemy').then(({ ownerToken, ownerUserId, allianceId, champId, cuId, warId }) => {
      addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10);
      cy.apiEndWar(ownerToken, allianceId, warId, true, 10);

      // Season stays active — the tab shows stats but no ended-season badge.
      openStatsAs(ownerUserId);

      cy.getByCy('statistics-table').should('be.visible');
      cy.getByCy('statistics-season-badge').should('not.exist');
    });
  });
});
