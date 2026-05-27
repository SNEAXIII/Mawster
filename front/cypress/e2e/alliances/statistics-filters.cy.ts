import {
  addStatsForPlayer,
  withWarScenario,
  withWarScenarioTwoPlayers,
  withWarScenarioDiffChampsPlayers,
  withWarScenarioTwoOwnerChamps,
} from './statistics-helpers';

describe('Alliance Statistics – Filters & Champion chart', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Ratio filter ──────────────────────────────────────────────────────────

  it('hides players below ratio threshold and shows empty-filtered state', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-rf-admin', role: 'admin' },
      {
        discord_token: 'stat-rf-owner',
        game_pseudo: 'RfOwner',
        create_alliance: { name: 'RfAlliance', tag: 'RF1' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-rf-admin'].access_token;
      const ownerToken = users['stat-rf-owner'].access_token;
      const allianceId = users['stat-rf-owner'].alliance_id!;
      const ownerAccId = users['stat-rf-owner'].account_id!;

      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 1);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        cy.apiLogin(users['stat-rf-owner'].user_id);
        cy.goToAllianceStatsTab();
        cy.getByCy('statistics-table').should('be.visible');
        cy.getByCy('statistics-ratio-filter').click();
        cy.contains('Minimum ratio ≥ 50%').click();
        cy.getByCy('statistics-empty-filtered').should('be.visible');
      });
    });
  });

  it('reset button appears when filter active and restores all rows', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-rst-admin', role: 'admin' },
      {
        discord_token: 'stat-rst-owner',
        game_pseudo: 'RstOwner',
        create_alliance: { name: 'RstAlliance', tag: 'RST' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-rst-admin'].access_token;
      const ownerToken = users['stat-rst-owner'].access_token;
      const allianceId = users['stat-rst-owner'].alliance_id!;
      const ownerAccId = users['stat-rst-owner'].account_id!;

      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 1);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        cy.apiLogin(users['stat-rst-owner'].user_id);
        cy.goToAllianceStatsTab();
        cy.getByCy('statistics-reset-filters').should('not.exist');
        cy.getByCy('statistics-ratio-filter').click();
        cy.contains('Minimum ratio ≥ 50%').click();
        cy.getByCy('statistics-reset-filters').should('be.visible').click();
        cy.getByCy('statistics-table').should('be.visible');
        cy.getByCy('statistics-reset-filters').should('not.exist');
      });
    });
  });

  // ── Champion chart ───────────────────────────────────────────────────────

  it('clicking a row highlights the player and shows reset button', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-click-admin', role: 'admin' },
      {
        discord_token: 'stat-click-owner',
        game_pseudo: 'ClickOwner',
        create_alliance: { name: 'ClickAlliance', tag: 'CLK' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-click-admin'].access_token;
      const ownerToken = users['stat-click-owner'].access_token;
      const allianceId = users['stat-click-owner'].alliance_id!;
      const ownerAccId = users['stat-click-owner'].account_id!;

      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        cy.apiLogin(users['stat-click-owner'].user_id);
        cy.goToAllianceStatsTab();
        cy.getByCy('statistics-reset-filters').should('not.exist');
        cy.getByCy(`statistics-row-${ownerAccId}`).click();
        cy.getByCy(`statistics-row-${ownerAccId}`).should('have.class', 'bg-muted');
        cy.getByCy('statistics-reset-filters').should('be.visible');
        cy.getByCy('statistics-reset-filters').click();
        cy.getByCy(`statistics-row-${ownerAccId}`).should('not.have.class', 'bg-muted');
        cy.getByCy('statistics-reset-filters').should('not.exist');
      });
    });
  });

  it('war filter shows only ended wars and filters the chart', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-wf-admin', role: 'admin' },
      {
        discord_token: 'stat-wf-owner',
        game_pseudo: 'WfOwner',
        create_alliance: { name: 'WfAlliance', tag: 'WF1' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-wf-admin'].access_token;
      const ownerToken = users['stat-wf-owner'].access_token;
      const allianceId = users['stat-wf-owner'].alliance_id!;
      const ownerAccId = users['stat-wf-owner'].account_id!;

      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Ended Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        cy.apiCreateWar(ownerToken, allianceId, 'Active Enemy');
        // active war — not ended, should NOT appear in war filter
        cy.apiLogin(users['stat-wf-owner'].user_id);
        cy.goToAllianceStatsTab();
        cy.getByCy('statistics-war-filter').click();
        cy.contains('Ended Enemy').should('be.visible');
        cy.contains('Active Enemy').should('not.exist');
      });
    });
  });

  it('chart metric toggle switches between deathless, all and kos', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-cm-admin', role: 'admin' },
      {
        discord_token: 'stat-cm-owner',
        game_pseudo: 'CmOwner',
        create_alliance: { name: 'CmAlliance', tag: 'CM1' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-cm-admin'].access_token;
      const ownerToken = users['stat-cm-owner'].access_token;
      const allianceId = users['stat-cm-owner'].alliance_id!;
      const ownerAccId = users['stat-cm-owner'].account_id!;

      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 1);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        cy.apiLogin(users['stat-cm-owner'].user_id);
        cy.goToAllianceStatsTab();
        cy.getByCy('chart-metric-deathless').should('not.have.attr', 'data-variant', 'outline');
        cy.getByCy('chart-metric-kos').click();
        cy.getByCy('chart-metric-kos').should('not.have.attr', 'data-variant', 'outline');
        cy.getByCy('chart-metric-all').click();
        cy.getByCy('chart-metric-all').should('not.have.attr', 'data-variant', 'outline');
      });
    });
  });

  it('see detail button opens the champion detail modal', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-modal-admin', role: 'admin' },
      {
        discord_token: 'stat-modal-owner',
        game_pseudo: 'ModalOwner',
        create_alliance: { name: 'ModalAlliance', tag: 'MDL' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-modal-admin'].access_token;
      const ownerToken = users['stat-modal-owner'].access_token;
      const allianceId = users['stat-modal-owner'].alliance_id!;
      const ownerAccId = users['stat-modal-owner'].account_id!;

      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        cy.apiLogin(users['stat-modal-owner'].user_id);
        cy.goToAllianceStatsTab();
        cy.getByCy('champion-detail-modal').should('not.exist');
        cy.getByCy('chart-see-detail').click();
        cy.getByCy('champion-detail-modal').should('be.visible');
        cy.getByCy('champion-detail-modal').contains('Iron Man').should('exist');
      });
    });
  });

  it('clicking the same row again deselects the player', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-tog-admin', role: 'admin' },
      {
        discord_token: 'stat-tog-owner',
        game_pseudo: 'TogOwner',
        create_alliance: { name: 'TogAlliance', tag: 'TOG' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-tog-admin'].access_token;
      const ownerToken = users['stat-tog-owner'].access_token;
      const allianceId = users['stat-tog-owner'].alliance_id!;
      const ownerAccId = users['stat-tog-owner'].account_id!;

      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        cy.apiLogin(users['stat-tog-owner'].user_id);
        cy.goToAllianceStatsTab();
        cy.getByCy(`statistics-row-${ownerAccId}`).click();
        cy.getByCy(`statistics-row-${ownerAccId}`).should('have.class', 'bg-muted');
        cy.getByCy(`statistics-row-${ownerAccId}`).click();
        cy.getByCy(`statistics-row-${ownerAccId}`).should('not.have.class', 'bg-muted');
        cy.getByCy('statistics-reset-filters').should('not.exist');
      });
    });
  });

  it('reset button resets war filter back to all wars', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-wfr-admin', role: 'admin' },
      {
        discord_token: 'stat-wfr-owner',
        game_pseudo: 'WfrOwner',
        create_alliance: { name: 'WfrAlliance', tag: 'WFR' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-wfr-admin'].access_token;
      const ownerToken = users['stat-wfr-owner'].access_token;
      const allianceId = users['stat-wfr-owner'].alliance_id!;
      const ownerAccId = users['stat-wfr-owner'].account_id!;

      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'War1', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        cy.apiLogin(users['stat-wfr-owner'].user_id);
        cy.goToAllianceStatsTab();
        cy.getByCy('statistics-war-filter').click();
        cy.getByCy(`statistics-war-${warId}`).click();
        cy.getByCy('statistics-reset-filters').should('be.visible').click();
        cy.getByCy('statistics-war-filter').should('contain', 'All wars');
      });
    });
  });

  it('clicking a row shows that player name in the chart area', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-pname-admin', role: 'admin' },
      {
        discord_token: 'stat-pname-owner',
        game_pseudo: 'PnameOwner',
        create_alliance: { name: 'PnameAlliance', tag: 'PNM' },
        battlegroup: 1,
      },
      {
        discord_token: 'stat-pname-member',
        game_pseudo: 'PnameMember',
        join_alliance_token: 'stat-pname-owner',
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-pname-admin'].access_token;
      const ownerToken = users['stat-pname-owner'].access_token;
      const allianceId = users['stat-pname-owner'].alliance_id!;
      const ownerAccId = users['stat-pname-owner'].account_id!;
      const memberAccId = users['stat-pname-member'].account_id!;
      const memberToken = users['stat-pname-member'].access_token;

      withWarScenarioTwoPlayers(
        adminToken,
        ownerToken,
        ownerAccId,
        memberToken,
        memberAccId,
        allianceId,
        'Enemy',
        ({ champId, cuOwnerId, cuMemberId, warId }) => {
          addStatsForPlayer(ownerToken, allianceId, warId, champId, cuOwnerId, 10);
          addStatsForPlayer(ownerToken, allianceId, warId, champId, cuMemberId, 20);
          cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
          cy.apiLogin(users['stat-pname-owner'].user_id);
          cy.goToAllianceStatsTab();
          cy.getByCy(`statistics-row-${memberAccId}`).click();
          cy.contains('PnameMember').should('be.visible');
        },
      );
    });
  });

  it('champion detail modal closes and can sort by KOs', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-mds-admin', role: 'admin' },
      {
        discord_token: 'stat-mds-owner',
        game_pseudo: 'MdsOwner',
        create_alliance: { name: 'MdsAlliance', tag: 'MDS' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-mds-admin'].access_token;
      const ownerToken = users['stat-mds-owner'].access_token;
      const allianceId = users['stat-mds-owner'].alliance_id!;
      const ownerAccId = users['stat-mds-owner'].account_id!;

      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 1);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        cy.apiLogin(users['stat-mds-owner'].user_id);
        cy.goToAllianceStatsTab();
        cy.getByCy('chart-metric-all').click();
        cy.getByCy('chart-see-detail').click();
        cy.getByCy('champion-detail-modal').should('be.visible');
        // sort by KOs column
        cy.getByCy('champion-detail-modal').contains('KOs').click();
        cy.getByCy('champion-detail-modal').contains('Iron Man').should('exist');
        // close modal
        cy.get('body').type('{esc}');
        cy.getByCy('champion-detail-modal').should('not.exist');
      });
    });
  });

  // ── Group filter ──────────────────────────────────────────────────────────

  it("group filter updates the champion chart to show only that group's champions", () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-grc-admin', role: 'admin' },
      {
        discord_token: 'stat-grc-owner',
        game_pseudo: 'GrcOwner',
        create_alliance: { name: 'GrcAlliance', tag: 'GRC' },
        battlegroup: 1,
      },
      {
        discord_token: 'stat-grc-member',
        game_pseudo: 'GrcMember',
        join_alliance_token: 'stat-grc-owner',
        battlegroup: 2,
      },
    ]).then((users) => {
      const adminToken = users['stat-grc-admin'].access_token;
      const ownerToken = users['stat-grc-owner'].access_token;
      const allianceId = users['stat-grc-owner'].alliance_id!;
      const ownerAccId = users['stat-grc-owner'].account_id!;
      const memberAccId = users['stat-grc-member'].account_id!;
      const memberToken = users['stat-grc-member'].access_token;

      withWarScenarioDiffChampsPlayers(
        adminToken,
        ownerToken,
        ownerAccId,
        memberToken,
        memberAccId,
        allianceId,
        'Enemy',
        ({ champ1Id, champ2Id, cuOwnerId, cuMemberId, warId }) => {
          addStatsForPlayer(ownerToken, allianceId, warId, champ1Id, cuOwnerId, 10, 0, 1);
          addStatsForPlayer(ownerToken, allianceId, warId, champ2Id, cuMemberId, 10, 0, 2);
          cy.apiEndWar(ownerToken, allianceId, warId, true, 10);

          cy.apiLogin(users['stat-grc-owner'].user_id);
          cy.goToAllianceStatsTab();

          // no group filter: both champions visible in chart legend
          cy.contains('Iron Man').should('exist');
          cy.contains('Wolverine').should('exist');

          // G1 → only Iron Man (owner) in chart
          cy.getByCy('statistics-group-filter').click();
          cy.contains('G1').click();
          cy.contains('Iron Man').should('exist');
          cy.contains('Wolverine').should('not.exist');

          // G2 → only Wolverine (member) in chart
          cy.getByCy('statistics-group-filter').click();
          cy.contains('G2').click();
          cy.contains('Wolverine').should('exist');
          cy.contains('Iron Man').should('not.exist');
        },
      );
    });
  });

  // ── Deathless filter ─────────────────────────────────────────────────────

  it('deathless metric shows only ko_count=0 fights by default, all shows both', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-dl-admin', role: 'admin' },
      {
        discord_token: 'stat-dl-owner',
        game_pseudo: 'DlOwner',
        create_alliance: { name: 'DlAlliance', tag: 'DL1' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-dl-admin'].access_token;
      const ownerToken = users['stat-dl-owner'].access_token;
      const allianceId = users['stat-dl-owner'].alliance_id!;
      const ownerAccId = users['stat-dl-owner'].account_id!;

      withWarScenarioTwoOwnerChamps(
        adminToken,
        ownerToken,
        ownerAccId,
        allianceId,
        'Enemy',
        ({ champ1Id, champ2Id, cu1Id, cu2Id, warId }) => {
          // Iron Man node 10: deathless (ko_count=0)
          addStatsForPlayer(ownerToken, allianceId, warId, champ1Id, cu1Id, 10, 0);
          // Wolverine node 11: not deathless (ko_count=1)
          addStatsForPlayer(ownerToken, allianceId, warId, champ2Id, cu2Id, 11, 1);
          cy.apiEndWar(ownerToken, allianceId, warId, true, 10);

          cy.apiLogin(users['stat-dl-owner'].user_id);
          cy.goToAllianceStatsTab();

          // default metric is deathless → only Iron Man visible
          cy.getByCy('chart-metric-deathless').should('be.visible');
          cy.contains('Iron Man').should('exist');
          cy.contains('Wolverine').should('not.exist');

          // switch to all → both champions visible
          cy.getByCy('chart-metric-all').click();
          cy.contains('Iron Man').should('exist');
          cy.contains('Wolverine').should('exist');
        },
      );
    });
  });

  it('filters by group — shows G1 player and G2 player in their respective filters', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-grp-admin', role: 'admin' },
      {
        discord_token: 'stat-grp-owner',
        game_pseudo: 'GrpOwner',
        create_alliance: { name: 'GrpAlliance', tag: 'GRP' },
        battlegroup: 1,
      },
      {
        discord_token: 'stat-grp-member',
        game_pseudo: 'GrpMember',
        join_alliance_token: 'stat-grp-owner',
        battlegroup: 2,
      },
    ]).then((users) => {
      const adminToken = users['stat-grp-admin'].access_token;
      const ownerToken = users['stat-grp-owner'].access_token;
      const allianceId = users['stat-grp-owner'].alliance_id!;
      const ownerAccId = users['stat-grp-owner'].account_id!;
      const memberAccId = users['stat-grp-member'].account_id!;
      const memberToken = users['stat-grp-member'].access_token;
      // owner → G1 (battlegroup:1), member → G2 (battlegroup:2)

      withWarScenarioDiffChampsPlayers(
        adminToken,
        ownerToken,
        ownerAccId,
        memberToken,
        memberAccId,
        allianceId,
        'Enemy',
        ({ champ1Id, champ2Id, cuOwnerId, cuMemberId, warId }) => {
          addStatsForPlayer(ownerToken, allianceId, warId, champ1Id, cuOwnerId, 10, 0, 1);
          addStatsForPlayer(ownerToken, allianceId, warId, champ2Id, cuMemberId, 10, 0, 2);
          cy.apiEndWar(ownerToken, allianceId, warId, true, 10);

          cy.apiLogin(users['stat-grp-owner'].user_id);
          cy.goToAllianceStatsTab();
          cy.getByCy('statistics-table').find('tbody tr').should('have.length', 2);

          // filter to G1 → only owner visible
          cy.getByCy('statistics-group-filter').click();
          cy.contains('G1').click();
          cy.getByCy('statistics-table').find('tbody tr').should('have.length', 1);
          cy.contains('GrpOwner').should('exist');

          // filter to G2 → only member visible
          cy.getByCy('statistics-group-filter').click();
          cy.contains('G2').click();
          cy.getByCy('statistics-table').find('tbody tr').should('have.length', 1);
          cy.contains('GrpMember').should('exist');
        },
      );
    });
  });
});
