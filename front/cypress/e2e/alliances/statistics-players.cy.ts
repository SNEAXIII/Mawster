import { BACKEND } from '../../support/e2e';
import {
  addStatsForPlayer,
  setupEndedAssistWar,
  withWarScenario,
  withWarScenarioTwoPlayers,
  withWarScenarioDefender,
} from './statistics-helpers';

describe('Alliance Statistics – Players, members & perspective', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── War participation stats ───────────────────────────────────────────────

  it('shows wars participated count and avg fights per war after one ended war', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-wp-admin', role: 'admin' },
      {
        discord_token: 'stat-wp-owner',
        game_pseudo: 'WpOwner',
        create_alliance: { name: 'WpAlliance', tag: 'WP1' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-wp-admin'].access_token;
      const ownerToken = users['stat-wp-owner'].access_token;
      const allianceId = users['stat-wp-owner'].alliance_id!;
      const ownerAccId = users['stat-wp-owner'].account_id!;

      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 0);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        cy.apiLogin(users['stat-wp-owner'].user_id);
        cy.goToAllianceStatsTab();
        // 1 war, 1 fight → wars=1, avg=1.0
        cy.getByCy('statistics-table')
          .find('tbody tr')
          .first()
          .within(() => {
            cy.contains('1').should('exist');
            cy.contains('1.0').should('exist');
          });
      });
    });
  });

  it('shows boss+MB average of 1.0 after one boss fight in one war', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-bm-admin', role: 'admin' },
      {
        discord_token: 'stat-bm-owner',
        game_pseudo: 'BmOwner',
        create_alliance: { name: 'BmAlliance', tag: 'BM1' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-bm-admin'].access_token;
      const ownerToken = users['stat-bm-owner'].access_token;
      const allianceId = users['stat-bm-owner'].alliance_id!;
      const ownerAccId = users['stat-bm-owner'].account_id!;

      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 50, 0);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        cy.apiLogin(users['stat-bm-owner'].user_id);
        cy.goToAllianceStatsTab();
        cy.getByCy('statistics-table')
          .find('tbody tr')
          .first()
          .within(() => {
            cy.contains('1.0').should('exist');
          });
      });
    });
  });

  // ── Member filter ─────────────────────────────────────────────────────────

  it('hides former member by default and shows them with all-members filter', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-fm-admin', role: 'admin' },
      {
        discord_token: 'stat-fm-owner',
        game_pseudo: 'FmOwner',
        create_alliance: { name: 'FmAlliance', tag: 'FM1' },
        battlegroup: 1,
      },
      {
        discord_token: 'stat-fm-member',
        game_pseudo: 'FmMember',
        join_alliance_token: 'stat-fm-owner',
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-fm-admin'].access_token;
      const ownerToken = users['stat-fm-owner'].access_token;
      const allianceId = users['stat-fm-owner'].alliance_id!;
      const ownerAccId = users['stat-fm-owner'].account_id!;
      const memberAccId = users['stat-fm-member'].account_id!;
      const memberToken = users['stat-fm-member'].access_token;

      withWarScenarioTwoPlayers(
        adminToken,
        ownerToken,
        ownerAccId,
        memberToken,
        memberAccId,
        allianceId,
        'Enemy',
        ({ champId, cuOwnerId, cuMemberId, warId }) => {
          addStatsForPlayer(ownerToken, allianceId, warId, champId, cuOwnerId, 10, 0);
          addStatsForPlayer(ownerToken, allianceId, warId, champId, cuMemberId, 11, 0);
          cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
          cy.request({
            method: 'DELETE',
            url: `${BACKEND}/alliances/${allianceId}/members/${memberAccId}`,
            headers: { Authorization: `Bearer ${ownerToken}` },
          });
          cy.apiLogin(users['stat-fm-owner'].user_id);
          cy.goToAllianceStatsTab();
          // default current filter → only owner visible
          cy.getByCy('statistics-table').find('tbody tr').should('have.length', 1);
          cy.contains('FmMember').should('not.exist');
          // switch to all → both visible
          cy.getByCy('statistics-member-filter').click();
          cy.contains('All members').click();
          cy.getByCy('statistics-table').find('tbody tr').should('have.length', 2);
          cy.contains('FmMember').should('exist');
        },
      );
    });
  });

  it('former member shows logout icon; current member does not', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-icon-admin', role: 'admin' },
      {
        discord_token: 'stat-icon-owner',
        game_pseudo: 'IconOwner',
        create_alliance: { name: 'IconAlliance', tag: 'ICN' },
        battlegroup: 1,
      },
      {
        discord_token: 'stat-icon-member',
        game_pseudo: 'IconMember',
        join_alliance_token: 'stat-icon-owner',
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-icon-admin'].access_token;
      const ownerToken = users['stat-icon-owner'].access_token;
      const allianceId = users['stat-icon-owner'].alliance_id!;
      const ownerAccId = users['stat-icon-owner'].account_id!;
      const memberAccId = users['stat-icon-member'].account_id!;
      const memberToken = users['stat-icon-member'].access_token;

      withWarScenarioTwoPlayers(
        adminToken,
        ownerToken,
        ownerAccId,
        memberToken,
        memberAccId,
        allianceId,
        'Enemy',
        ({ champId, cuOwnerId, cuMemberId, warId }) => {
          addStatsForPlayer(ownerToken, allianceId, warId, champId, cuOwnerId, 10, 0);
          addStatsForPlayer(ownerToken, allianceId, warId, champId, cuMemberId, 11, 0);
          cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
          cy.request({
            method: 'DELETE',
            url: `${BACKEND}/alliances/${allianceId}/members/${memberAccId}`,
            headers: { Authorization: `Bearer ${ownerToken}` },
          });
          cy.apiLogin(users['stat-icon-owner'].user_id);
          cy.goToAllianceStatsTab();
          cy.getByCy('statistics-member-filter').click();
          cy.contains('All members').click();
          cy.getByCy(`former-badge-${memberAccId}`).should('exist');
          cy.getByCy(`former-badge-${ownerAccId}`).should('not.exist');
        },
      );
    });
  });

  it('former-members filter shows only former member', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-fonly-admin', role: 'admin' },
      {
        discord_token: 'stat-fonly-owner',
        game_pseudo: 'FonlyOwner',
        create_alliance: { name: 'FonlyAlliance', tag: 'FO1' },
        battlegroup: 1,
      },
      {
        discord_token: 'stat-fonly-member',
        game_pseudo: 'FonlyMember',
        join_alliance_token: 'stat-fonly-owner',
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-fonly-admin'].access_token;
      const ownerToken = users['stat-fonly-owner'].access_token;
      const allianceId = users['stat-fonly-owner'].alliance_id!;
      const ownerAccId = users['stat-fonly-owner'].account_id!;
      const memberAccId = users['stat-fonly-member'].account_id!;
      const memberToken = users['stat-fonly-member'].access_token;

      withWarScenarioTwoPlayers(
        adminToken,
        ownerToken,
        ownerAccId,
        memberToken,
        memberAccId,
        allianceId,
        'Enemy',
        ({ champId, cuOwnerId, cuMemberId, warId }) => {
          addStatsForPlayer(ownerToken, allianceId, warId, champId, cuOwnerId, 10, 0);
          addStatsForPlayer(ownerToken, allianceId, warId, champId, cuMemberId, 11, 0);
          cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
          cy.request({
            method: 'DELETE',
            url: `${BACKEND}/alliances/${allianceId}/members/${memberAccId}`,
            headers: { Authorization: `Bearer ${ownerToken}` },
          });
          cy.apiLogin(users['stat-fonly-owner'].user_id);
          cy.goToAllianceStatsTab();
          cy.getByCy('statistics-member-filter').click();
          cy.contains('Former members').click();
          cy.getByCy('statistics-table').find('tbody tr').should('have.length', 1);
          cy.contains('FonlyMember').should('exist');
          cy.contains('FonlyOwner').should('not.exist');
        },
      );
    });
  });

  // ── Perspective filter ────────────────────────────────────────────────────

  it('defender perspective shows the attacked champion instead of the attacker', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-pv-admin', role: 'admin' },
      {
        discord_token: 'stat-pv-owner',
        game_pseudo: 'PvOwner',
        create_alliance: { name: 'PvAlliance', tag: 'PV1' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-pv-admin'].access_token;
      const ownerToken = users['stat-pv-owner'].access_token;
      const allianceId = users['stat-pv-owner'].alliance_id!;
      const ownerAccId = users['stat-pv-owner'].account_id!;

      // attacker = Iron Man, defender = Wolverine
      withWarScenarioDefender(
        adminToken,
        ownerToken,
        ownerAccId,
        allianceId,
        'Enemy',
        ({ champ1Id, champ2Id, cuId, warId }) => {
          // Iron Man attacks Wolverine (deathless)
          cy.apiPlaceWarDefender(ownerToken, allianceId, warId, 1, 10, champ2Id, 7, 3, 0);
          cy.apiAssignWarAttacker(ownerToken, allianceId, warId, 1, 10, cuId);
          cy.apiEndWar(ownerToken, allianceId, warId, true, 10);

          cy.apiLogin(users['stat-pv-owner'].user_id);
          cy.goToAllianceStatsTab();

          // default attacker perspective → Iron Man visible
          cy.contains('Iron Man').should('exist');
          cy.contains('Wolverine').should('not.exist');

          // switch to defender perspective → Wolverine visible
          cy.getByCy('chart-perspective-defender').click();
          cy.contains('Wolverine').should('exist');
          cy.contains('Iron Man').should('not.exist');
        },
      );
    });
  });

  // ── Assist stats ──────────────────────────────────────────────────────────

  it('shows total_assists = 1 for assistor and 0.5 fights for both after an assisted combat', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-ast-admin', role: 'admin' },
      {
        discord_token: 'stat-ast-owner',
        game_pseudo: 'AstOwner',
        create_alliance: { name: 'AstAlliance', tag: 'AST' },
        battlegroup: 1,
      },
      {
        discord_token: 'stat-ast-member',
        game_pseudo: 'AstMember',
        join_alliance_token: 'stat-ast-owner',
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-ast-admin'].access_token;
      const ownerToken = users['stat-ast-owner'].access_token;
      const memberToken = users['stat-ast-member'].access_token;
      const allianceId = users['stat-ast-owner'].alliance_id!;
      const ownerAccId = users['stat-ast-owner'].account_id!;
      const memberAccId = users['stat-ast-member'].account_id!;

      setupEndedAssistWar({ adminToken, ownerToken, ownerAccId, memberToken, memberAccId, allianceId });

      cy.apiLogin(users['stat-ast-owner'].user_id);
      cy.goToAllianceStatsTab();
      cy.getByCy('statistics-member-filter').click();
      cy.contains('All members').click();

      // Assisted player (owner): fights = 0.5
      cy.getByCy(`statistics-row-${ownerAccId}`).within(() => {
        cy.contains('0.5').should('exist');
      });

      // Assistor (member): assists = 1, fights = 0.5
      cy.getByCy(`statistics-row-${memberAccId}`).within(() => {
        cy.contains('1').should('exist');
        cy.contains('0.5').should('exist');
      });

      // Scores: owner (received assist, 0 KOs) = 0; member (gave assist) = 2
      cy.getByCy(`stat-score-${ownerAccId}`).should('have.text', '0');
      cy.getByCy(`stat-score-${memberAccId}`).should('have.text', '2');
    });
  });
});
