import { addStatsForPlayer, withWarScenario } from './statistics-helpers';

describe('Alliance Statistics – Empty states & Happy path', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Empty states ──────────────────────────────────────────────────────────

  it('shows empty state when no wars have been played', () => {
    cy.apiBatchSetup([
      {
        discord_token: 'stat-empty-owner',
        game_pseudo: 'EmptyOwner',
        create_alliance: { name: 'EmptyAlliance', tag: 'EMP' },
      },
    ]).then((users) => {
      cy.apiLogin(users['stat-empty-owner'].user_id);
      cy.goToAllianceStatsTab();
      cy.getByCy('statistics-empty').should('be.visible');
    });
  });

  it('shows empty state when only an active (ongoing) war exists', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-act-admin', role: 'admin' },
      {
        discord_token: 'stat-act-owner',
        game_pseudo: 'ActiveOwner',
        create_alliance: { name: 'ActiveAlliance', tag: 'ACT' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-act-admin'].access_token;
      const ownerToken = users['stat-act-owner'].access_token;
      const allianceId = users['stat-act-owner'].alliance_id!;
      const ownerAccId = users['stat-act-owner'].account_id!;

      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10);
        // war NOT ended — stays active
        cy.apiLogin(users['stat-act-owner'].user_id);
        cy.goToAllianceStatsTab();
        cy.getByCy('statistics-empty').should('be.visible');
      });
    });
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('shows statistics table after an ended war', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-hp-admin', role: 'admin' },
      {
        discord_token: 'stat-hp-owner',
        game_pseudo: 'HpOwner',
        create_alliance: { name: 'HpAlliance', tag: 'HP1' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-hp-admin'].access_token;
      const ownerToken = users['stat-hp-owner'].access_token;
      const allianceId = users['stat-hp-owner'].alliance_id!;
      const ownerAccId = users['stat-hp-owner'].account_id!;

      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        cy.apiLogin(users['stat-hp-owner'].user_id);
        cy.goToAllianceStatsTab();
        cy.getByCy('statistics-table').should('be.visible');
        cy.getByCy('statistics-table').find('tbody tr').should('have.length', 1);
      });
    });
  });

  it('shows correct fight count and ratio for a player with a KO', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-ko-admin', role: 'admin' },
      {
        discord_token: 'stat-ko-owner',
        game_pseudo: 'KoOwner',
        create_alliance: { name: 'KoAlliance', tag: 'KO1' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-ko-admin'].access_token;
      const ownerToken = users['stat-ko-owner'].access_token;
      const allianceId = users['stat-ko-owner'].alliance_id!;
      const ownerAccId = users['stat-ko-owner'].account_id!;

      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 1);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        cy.apiLogin(users['stat-ko-owner'].user_id);
        cy.goToAllianceStatsTab();
        cy.getByCy('statistics-table')
          .find('tbody tr')
          .first()
          .within(() => {
            cy.contains('1').should('exist'); // total_fights
            cy.contains('0%').should('exist'); // ratio = (1 - 1/1) * 100
          });
      });
    });
  });
});
