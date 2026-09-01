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
    .apiRequest(adminAT, 'POST', `/admin/seasons`, { number })
    .then((res) => res.body as { id: string; number: number });
}

function openSeason(adminAT: string, seasonId: string) {
  return cy.apiOpenSeason(adminAT, seasonId);
}

// Closing a season frees the single-current slot so the next season can be created.
function closeSeason(adminAT: string, seasonId: string) {
  return cy.apiCloseSeason(adminAT, seasonId);
}

type FilterSetup = {
  adminAT: string;
  ownerAccId: string;
  allianceId: string;
  warId: string;
  userId: string;
};

/** 2 records inside season 1, 1 record with no season, then open the page. */
function seedMixedRecords(s: FilterSetup, then: () => void) {
  createSeason(s.adminAT, 1).then((season) => {
    cy.apiDevBulkCreateFightRecords(s.warId, s.allianceId, s.ownerAccId, 2, season.id);
    cy.apiDevBulkCreateFightRecords(s.warId, s.allianceId, s.ownerAccId, 1);

    cy.apiLogin(s.userId, 'knowledge-base');
    then();
  });
}

function expectRecordRows(count: number) {
  cy.getByCy('fight-records-table').find('tbody tr').should('have.length', count);
}

describe('Knowledge Base - Season Filter', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('default shows only seasonal records (all_seasons)', () => {
    setupSeasonFilter('kb-sf-def').then((s) => {
      seedMixedRecords(s, () => expectRecordRows(2));
    });
  });

  it('"All" shows every record regardless of season', () => {
    setupSeasonFilter('kb-sf-all').then((s) => {
      seedMixedRecords(s, () => {
        cy.selectOption('filter-season-selector-trigger', 'All');
        expectRecordRows(3);
      });
    });
  });

  it('"Pre-season" shows only records without a season', () => {
    setupSeasonFilter('kb-sf-off').then((s) => {
      seedMixedRecords(s, () => {
        cy.selectOption('filter-season-selector-trigger', 'Pre-season');
        expectRecordRows(1);
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

          cy.apiLogin(userId, 'knowledge-base');

          cy.selectOption('filter-season-selector-trigger', 'Current Season');
          expectRecordRows(1);
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

          cy.apiLogin(userId, 'knowledge-base');

          cy.selectOption('filter-season-selector-trigger', 'Specific Season');

          cy.selectOption('filter-season-id-trigger', 'Season 1');
          expectRecordRows(1);

          cy.selectOption('filter-season-id-trigger', 'Season 2');
          expectRecordRows(2);
        });
      });
    });
  });

  it('clear filter resets to all_seasons default', () => {
    setupSeasonFilter('kb-sf-clr').then((s) => {
      seedMixedRecords(s, () => {
        cy.selectOption('filter-season-selector-trigger', 'All');
        expectRecordRows(3);

        cy.getByCy('filter-clear').click();
        expectRecordRows(2);
      });
    });
  });
});
