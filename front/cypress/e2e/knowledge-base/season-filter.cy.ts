import { BACKEND } from '../../support/e2e';

function setupSeasonFilter(prefix: string) {
  const adminToken = `${prefix}-adm`;
  const ownerToken = `${prefix}-own`;

  return cy
    .apiBatchSetup([
      { discord_token: adminToken, role: 'admin' },
      {
        discord_token: ownerToken,
        game_pseudo: `${prefix}Own`.slice(0, 16),
        create_alliance: {
          name: `${prefix}Alliance`.slice(0, 30),
          tag: prefix.slice(0, 3).toUpperCase(),
        },
        battlegroup: 1,
      },
    ])
    .then((users) => {
      const adminAT = users[adminToken].access_token;
      const ownerAT = users[ownerToken].access_token;
      const ownerAccId = users[ownerToken].account_id!;
      const allianceId = users[ownerToken].alliance_id!;
      const userId = users[ownerToken].user_id;

      return cy
        .apiLoadChampions(adminAT, [
          { name: 'Iron Man', cls: 'Tech' },
          { name: 'Captain America', cls: 'Cosmic' },
        ])
        .then(() =>
          cy.apiCreateWar(ownerAT, allianceId, 'Opp').then((war) => {
            cy.apiEndWar(ownerAT, allianceId, war.id, true, 10);
            return cy.wrap({ adminAT, ownerAccId, allianceId, warId: war.id, userId });
          }),
        );
    });
}

function createSeason(adminAT: string, number: number) {
  return cy
    .request({
      method: 'POST',
      url: `${BACKEND}/admin/seasons`,
      headers: { Authorization: `Bearer ${adminAT}` },
      body: { number },
    })
    .then((res) => res.body as { id: string; number: number });
}

function openSeason(adminAT: string, seasonId: string) {
  return cy.request({
    method: 'PATCH',
    url: `${BACKEND}/admin/seasons/${seasonId}/open`,
    headers: { Authorization: `Bearer ${adminAT}` },
    body: {},
  });
}

// Closing a season frees the single-current slot so the next season can be created.
function closeSeason(adminAT: string, seasonId: string) {
  return cy.request({
    method: 'PATCH',
    url: `${BACKEND}/admin/seasons/${seasonId}/close`,
    headers: { Authorization: `Bearer ${adminAT}` },
    body: {},
  });
}

describe('Knowledge Base - Season Filter', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('default shows only seasonal records (all_seasons)', () => {
    setupSeasonFilter('kb-sf-def').then(({ adminAT, ownerAccId, allianceId, warId, userId }) => {
      createSeason(adminAT, 1).then((season) => {
        cy.apiDevBulkCreateFightRecords(warId, allianceId, ownerAccId, 2, season.id);
        cy.apiDevBulkCreateFightRecords(warId, allianceId, ownerAccId, 1);

        cy.apiLogin(userId);
        cy.visit('/game/knowledge-base');
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
      });
    });
  });

  it('"All" shows every record regardless of season', () => {
    setupSeasonFilter('kb-sf-all').then(({ adminAT, ownerAccId, allianceId, warId, userId }) => {
      createSeason(adminAT, 1).then((season) => {
        cy.apiDevBulkCreateFightRecords(warId, allianceId, ownerAccId, 2, season.id);
        cy.apiDevBulkCreateFightRecords(warId, allianceId, ownerAccId, 1);

        cy.apiLogin(userId);
        cy.visit('/game/knowledge-base');

        cy.getByCy('filter-season-selector-trigger').click();
        cy.contains('[role="option"]', 'All').click();
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 3);
      });
    });
  });

  it('"Off-Season" shows only records without a season', () => {
    setupSeasonFilter('kb-sf-off').then(({ adminAT, ownerAccId, allianceId, warId, userId }) => {
      createSeason(adminAT, 1).then((season) => {
        cy.apiDevBulkCreateFightRecords(warId, allianceId, ownerAccId, 2, season.id);
        cy.apiDevBulkCreateFightRecords(warId, allianceId, ownerAccId, 1);

        cy.apiLogin(userId);
        cy.visit('/game/knowledge-base');

        cy.getByCy('filter-season-selector-trigger').click();
        cy.contains('[role="option"]', 'Off-Season').click();
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);
      });
    });
  });

  it('"Current Season" shows only records for the active season', () => {
    setupSeasonFilter('kb-sf-cur').then(({ adminAT, ownerAccId, allianceId, warId, userId }) => {
      createSeason(adminAT, 1).then((seasonA) => {
        // Close A so a second season can be created (single-current invariant), then open B.
        closeSeason(adminAT, seasonA.id);
        createSeason(adminAT, 2).then((seasonB) => {
          openSeason(adminAT, seasonB.id);
          cy.apiDevBulkCreateFightRecords(warId, allianceId, ownerAccId, 2, seasonA.id);
          cy.apiDevBulkCreateFightRecords(warId, allianceId, ownerAccId, 1, seasonB.id);

          cy.apiLogin(userId);
          cy.visit('/game/knowledge-base');

          cy.getByCy('filter-season-selector-trigger').click();
          cy.contains('[role="option"]', 'Current Season').click();
          cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);
        });
      });
    });
  });

  it('"Specific Season" shows only records for the selected season', () => {
    setupSeasonFilter('kb-sf-spe').then(({ adminAT, ownerAccId, allianceId, warId, userId }) => {
      createSeason(adminAT, 1).then((seasonA) => {
        // Close A so a second season can be created (single-current invariant).
        closeSeason(adminAT, seasonA.id);
        createSeason(adminAT, 2).then((seasonB) => {
          cy.apiDevBulkCreateFightRecords(warId, allianceId, ownerAccId, 1, seasonA.id);
          cy.apiDevBulkCreateFightRecords(warId, allianceId, ownerAccId, 2, seasonB.id);

          cy.apiLogin(userId);
          cy.visit('/game/knowledge-base');

          cy.getByCy('filter-season-selector-trigger').click();
          cy.contains('[role="option"]', 'Specific Season').click();

          cy.getByCy('filter-season-id-trigger').click();
          cy.contains('[role="option"]', 'Season 1').click();
          cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);

          cy.getByCy('filter-season-id-trigger').click();
          cy.contains('[role="option"]', 'Season 2').click();
          cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
        });
      });
    });
  });

  it('clear filter resets to all_seasons default', () => {
    setupSeasonFilter('kb-sf-clr').then(({ adminAT, ownerAccId, allianceId, warId, userId }) => {
      createSeason(adminAT, 1).then((season) => {
        cy.apiDevBulkCreateFightRecords(warId, allianceId, ownerAccId, 2, season.id);
        cy.apiDevBulkCreateFightRecords(warId, allianceId, ownerAccId, 1);

        cy.apiLogin(userId);
        cy.visit('/game/knowledge-base');

        cy.getByCy('filter-season-selector-trigger').click();
        cy.contains('[role="option"]', 'All').click();
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 3);

        cy.getByCy('filter-clear').click();
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
      });
    });
  });
});
