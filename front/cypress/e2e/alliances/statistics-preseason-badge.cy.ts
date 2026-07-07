import { addStatsForPlayer, closeSeason, createOpenSeason } from './statistics-helpers';

// The Statistics tab shows the "display season": the active season if one exists,
// otherwise the most recent ended season. During pre-season (a season has been
// closed and none is active) it must fall back to that ended season's stats and
// surface a badge naming it. When a season is active, no badge is shown.
describe('Alliance Statistics – Pre-season (ended-season fallback + badge)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows previous ended-season stats and the season badge during pre-season', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-pre-admin', role: 'admin' },
      {
        discord_token: 'stat-pre-owner',
        game_pseudo: 'PreOwner',
        create_alliance: { name: 'PreAlliance', tag: 'PRE' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-pre-admin'].access_token;
      const ownerToken = users['stat-pre-owner'].access_token;
      const allianceId = users['stat-pre-owner'].alliance_id!;
      const ownerAccId = users['stat-pre-owner'].account_id!;

      createOpenSeason(adminToken, 64).then((seasonId) => {
        cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs: { id: string }[]) => {
          cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs[0].id, '7r3').then((cu: { id: string }) => {
            cy.apiCreateWar(ownerToken, allianceId, 'Enemy').then((war: { id: string }) => {
              addStatsForPlayer(ownerToken, allianceId, war.id, champs[0].id, cu.id, 10);
              cy.apiEndWar(ownerToken, allianceId, war.id, true, 10);
              // Enter pre-season: close season 64 (active -> ended); no active season remains.
              closeSeason(adminToken, seasonId);

              cy.apiLogin(users['stat-pre-owner'].user_id);
              cy.goToAllianceStatsTab();

              // Stats from the ended season are still shown (not empty).
              cy.getByCy('statistics-table').should('be.visible');
              cy.getByCy('statistics-table').find('tbody tr').should('have.length', 1);
              // Badge names the ended season being displayed.
              cy.getByCy('statistics-season-badge').should('be.visible').and('contain', '64');
            });
          });
        });
      });
    });
  });

  it('does not show the season badge while a season is active', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-actbadge-admin', role: 'admin' },
      {
        discord_token: 'stat-actbadge-owner',
        game_pseudo: 'ActBadgeOwner',
        create_alliance: { name: 'ActBadgeAlliance', tag: 'ACB' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-actbadge-admin'].access_token;
      const ownerToken = users['stat-actbadge-owner'].access_token;
      const allianceId = users['stat-actbadge-owner'].alliance_id!;
      const ownerAccId = users['stat-actbadge-owner'].account_id!;

      createOpenSeason(adminToken, 64).then(() => {
        cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs: { id: string }[]) => {
          cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs[0].id, '7r3').then((cu: { id: string }) => {
            cy.apiCreateWar(ownerToken, allianceId, 'Enemy').then((war: { id: string }) => {
              addStatsForPlayer(ownerToken, allianceId, war.id, champs[0].id, cu.id, 10);
              cy.apiEndWar(ownerToken, allianceId, war.id, true, 10);
              // Season stays active — the tab shows stats but no ended-season badge.
              cy.apiLogin(users['stat-actbadge-owner'].user_id);
              cy.goToAllianceStatsTab();

              cy.getByCy('statistics-table').should('be.visible');
              cy.getByCy('statistics-season-badge').should('not.exist');
            });
          });
        });
      });
    });
  });
});
