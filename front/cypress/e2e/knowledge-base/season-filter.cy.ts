import type { BatchSetupFightRecordsSpec, BatchSetupSeasonSpec } from '../../support/index';

type SeasonFilterFixture = {
  seasons?: BatchSetupSeasonSpec[];
  records?: BatchSetupFightRecordsSpec[];
};

/**
 * Users, alliance, champions, seasons, the finished war and its fight records — one
 * request, then the page. Every test here differs only by the fixture it declares.
 */
function openKnowledgeBase(prefix: string, fixture: SeasonFilterFixture) {
  const adminToken = `${prefix}-adm`;
  const ownerToken = `${prefix}-own`;

  return cy
    .apiBatchSetup([
      {
        discord_token: adminToken,
        role: 'admin',
        champions: [
          { name: 'Iron Man', champion_class: 'Tech' },
          { name: 'Captain America', champion_class: 'Cosmic' },
        ],
        seasons: fixture.seasons ?? [],
      },
      {
        discord_token: ownerToken,
        game_pseudo: `${prefix}Own`.slice(0, 16),
        create_alliance: {
          name: `${prefix}Alliance`.slice(0, 30),
          tag: prefix.slice(0, 3).toUpperCase(),
        },
        battlegroup: 1,
        create_war: { opponent_name: 'Opp', end: true, win: true, elo_change: 10 },
        fight_records: fixture.records ?? [],
      },
    ])
    .then((users) => {
      cy.apiLogin(users[ownerToken].user_id, 'knowledge-base');
    });
}

/** 2 records inside season 1, 1 record with no season. */
const MIXED_RECORDS: SeasonFilterFixture = {
  seasons: [{ number: 1 }],
  records: [{ count: 2, season_number: 1 }, { count: 1 }],
};

function expectRecordRows(count: number) {
  cy.getByCy('fight-records-table').find('tbody tr').should('have.length', count);
}

describe('Knowledge Base - Season Filter', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('default shows only seasonal records (all_seasons)', () => {
    openKnowledgeBase('kb-sf-def', MIXED_RECORDS);

    expectRecordRows(2);
  });

  it('"All" shows every record regardless of season', () => {
    openKnowledgeBase('kb-sf-all', MIXED_RECORDS);

    cy.selectOption('filter-season-selector-trigger', 'All');
    expectRecordRows(3);
  });

  it('"Pre-season" shows only records without a season', () => {
    openKnowledgeBase('kb-sf-off', MIXED_RECORDS);

    cy.selectOption('filter-season-selector-trigger', 'Pre-season');
    expectRecordRows(1);
  });

  it('"Current Season" shows only records for the active season', () => {
    // Season 1 is ended so season 2 can take the single-current slot.
    openKnowledgeBase('kb-sf-cur', {
      seasons: [
        { number: 1, status: 'ended' },
        { number: 2, status: 'active' },
      ],
      records: [
        { count: 2, season_number: 1 },
        { count: 1, season_number: 2 },
      ],
    });

    cy.selectOption('filter-season-selector-trigger', 'Current Season');
    expectRecordRows(1);
  });

  it('"Specific Season" shows only records for the selected season', () => {
    openKnowledgeBase('kb-sf-spe', {
      seasons: [{ number: 1, status: 'ended' }, { number: 2 }],
      records: [
        { count: 1, season_number: 1 },
        { count: 2, season_number: 2 },
      ],
    });

    cy.selectOption('filter-season-selector-trigger', 'Specific Season');

    cy.selectOption('filter-season-id-trigger', 'Season 1');
    expectRecordRows(1);

    cy.selectOption('filter-season-id-trigger', 'Season 2');
    expectRecordRows(2);
  });

  it('clear filter resets to all_seasons default', () => {
    openKnowledgeBase('kb-sf-clr', MIXED_RECORDS);

    cy.selectOption('filter-season-selector-trigger', 'All');
    expectRecordRows(3);

    cy.getByCy('filter-clear').click();
    expectRecordRows(2);
  });
});
