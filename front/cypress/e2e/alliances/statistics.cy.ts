import { BACKEND, createAndActivateSeason } from '../../support/e2e';
// ── Helpers ──────────────────────────────────────────────────────────────

function setupEndedAssistWar(opts: {
  adminToken: string;
  ownerToken: string;
  ownerAccId: string;
  memberToken: string;
  memberAccId: string;
  allianceId: string;
}) {
  const { adminToken, ownerToken, ownerAccId, memberToken, memberAccId, allianceId } = opts;
  createAndActivateSeason(adminToken);
  return cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((ironManChamps: { id: string }[]) => {
    return cy.apiLoadChampion(adminToken, 'Wolverine', 'Mutant').then((wolvChamps: { id: string }[]) => {
      return cy
        .apiAddChampionToRoster(ownerToken, ownerAccId, ironManChamps[0].id, '7r3')
        .then((cuOwner: { id: string }) => {
          return cy
            .apiAddChampionToRoster(memberToken, memberAccId, wolvChamps[0].id, '7r3')
            .then((cuMember: { id: string }) => {
              return cy.apiCreateWar(ownerToken, allianceId, 'AstEnemy').then((war: { id: string }) => {
                cy.apiPlaceWarDefender(ownerToken, allianceId, war.id, 1, 10, ironManChamps[0].id, 7, 3, 0);
                cy.apiAssignWarAttacker(ownerToken, allianceId, war.id, 1, 10, cuOwner.id);
                cy.request({
                  method: 'POST',
                  url: `${BACKEND}/alliances/${allianceId}/wars/${war.id}/bg/1/node/10/assist`,
                  headers: { Authorization: `Bearer ${memberToken}` },
                  body: { champion_user_id: cuMember.id },
                });
                cy.apiEndWar(ownerToken, allianceId, war.id, true, 10);
              });
            });
        });
    });
  });
}

function addStatsForPlayer(
  token: string,
  allianceId: string,
  warId: string,
  champId: string,
  championUserId: string,
  nodeNumber: number,
  koCount = 0,
  bg = 1,
) {
  cy.apiPlaceWarDefender(token, allianceId, warId, bg, nodeNumber, champId, 7, 3, 0);
  cy.apiAssignWarAttacker(token, allianceId, warId, bg, nodeNumber, championUserId);
  if (koCount > 0) cy.apiUpdateWarKo(token, allianceId, warId, bg, nodeNumber, koCount);
}

function goToStatsTab() {
  cy.navTo('alliances');
  cy.getByCy('tab-statistics').click();
}

function withWarScenario(
  adminToken: string,
  ownerToken: string,
  allianceId: string,
  ownerAccId: string,
  warName: string,
  cb: (args: { champId: string; cuId: string; warId: string }) => void,
) {
  createAndActivateSeason(adminToken).then(() => {
    cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs: { id: string }[]) => {
      cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs[0].id, '7r3').then((cu: { id: string }) => {
        cy.apiCreateWar(ownerToken, allianceId, warName).then((war: { id: string }) => {
          cb({ champId: champs[0].id, cuId: cu.id, warId: war.id });
        });
      });
    });
  });
}

function loadChampAndAddToTwoRosters(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  memberToken: string,
  memberAccId: string,
  cb: (args: { champId: string; cuOwnerId: string; cuMemberId: string }) => void,
) {
  cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs: { id: string }[]) => {
    cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs[0].id, '7r3').then((cuOwner: { id: string }) => {
      cy.apiAddChampionToRoster(memberToken, memberAccId, champs[0].id, '7r3').then((cuMember: { id: string }) => {
        cb({ champId: champs[0].id, cuOwnerId: cuOwner.id, cuMemberId: cuMember.id });
      });
    });
  });
}

function withWarScenarioTwoPlayers(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  memberToken: string,
  memberAccId: string,
  allianceId: string,
  warName: string,
  cb: (args: { champId: string; cuOwnerId: string; cuMemberId: string; warId: string }) => void,
) {
  createAndActivateSeason(adminToken).then(() => {
    loadChampAndAddToTwoRosters(
      adminToken,
      ownerToken,
      ownerAccId,
      memberToken,
      memberAccId,
      ({ champId, cuOwnerId, cuMemberId }) => {
        cy.apiCreateWar(ownerToken, allianceId, warName).then((war: { id: string }) => {
          cb({ champId, cuOwnerId, cuMemberId, warId: war.id });
        });
      },
    );
  });
}

function loadTwoChampsAddToRosters(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  memberToken: string,
  memberAccId: string,
  cb: (args: { champ1Id: string; champ2Id: string; cuOwnerId: string; cuMemberId: string }) => void,
) {
  cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs1: { id: string }[]) => {
    cy.apiLoadChampion(adminToken, 'Wolverine', 'Mutant').then((champs2: { id: string }[]) => {
      cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs1[0].id, '7r3').then((cuOwner: { id: string }) => {
        cy.apiAddChampionToRoster(memberToken, memberAccId, champs2[0].id, '7r3').then((cuMember: { id: string }) => {
          cb({ champ1Id: champs1[0].id, champ2Id: champs2[0].id, cuOwnerId: cuOwner.id, cuMemberId: cuMember.id });
        });
      });
    });
  });
}

function withWarScenarioDiffChampsPlayers(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  memberToken: string,
  memberAccId: string,
  allianceId: string,
  warName: string,
  cb: (args: { champ1Id: string; champ2Id: string; cuOwnerId: string; cuMemberId: string; warId: string }) => void,
) {
  createAndActivateSeason(adminToken).then(() => {
    loadTwoChampsAddToRosters(
      adminToken,
      ownerToken,
      ownerAccId,
      memberToken,
      memberAccId,
      ({ champ1Id, champ2Id, cuOwnerId, cuMemberId }) => {
        cy.apiCreateWar(ownerToken, allianceId, warName).then((war: { id: string }) => {
          cb({ champ1Id, champ2Id, cuOwnerId, cuMemberId, warId: war.id });
        });
      },
    );
  });
}

function loadTwoChampsAddToOneRoster(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  cb: (args: { champ1Id: string; champ2Id: string; cu1Id: string; cu2Id: string }) => void,
) {
  cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs1: { id: string }[]) => {
    cy.apiLoadChampion(adminToken, 'Wolverine', 'Mutant').then((champs2: { id: string }[]) => {
      cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs1[0].id, '7r3').then((cu1: { id: string }) => {
        cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs2[0].id, '7r3').then((cu2: { id: string }) => {
          cb({ champ1Id: champs1[0].id, champ2Id: champs2[0].id, cu1Id: cu1.id, cu2Id: cu2.id });
        });
      });
    });
  });
}

function withWarScenarioTwoOwnerChamps(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  allianceId: string,
  warName: string,
  cb: (args: { champ1Id: string; champ2Id: string; cu1Id: string; cu2Id: string; warId: string }) => void,
) {
  createAndActivateSeason(adminToken).then(() => {
    loadTwoChampsAddToOneRoster(adminToken, ownerToken, ownerAccId, ({ champ1Id, champ2Id, cu1Id, cu2Id }) => {
      cy.apiCreateWar(ownerToken, allianceId, warName).then((war: { id: string }) => {
        cb({ champ1Id, champ2Id, cu1Id, cu2Id, warId: war.id });
      });
    });
  });
}

function loadTwoChampsAddOneToRoster(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  cb: (args: { champ1Id: string; champ2Id: string; cuId: string }) => void,
) {
  cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs1: { id: string }[]) => {
    cy.apiLoadChampion(adminToken, 'Wolverine', 'Mutant').then((champs2: { id: string }[]) => {
      cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs1[0].id, '7r3').then((cu: { id: string }) => {
        cb({ champ1Id: champs1[0].id, champ2Id: champs2[0].id, cuId: cu.id });
      });
    });
  });
}

function withWarScenarioDefender(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  allianceId: string,
  warName: string,
  cb: (args: { champ1Id: string; champ2Id: string; cuId: string; warId: string }) => void,
) {
  createAndActivateSeason(adminToken).then(() => {
    loadTwoChampsAddOneToRoster(adminToken, ownerToken, ownerAccId, ({ champ1Id, champ2Id, cuId }) => {
      cy.apiCreateWar(ownerToken, allianceId, warName).then((war: { id: string }) => {
        cb({ champ1Id, champ2Id, cuId, warId: war.id });
      });
    });
  });
}

describe('Alliance Statistics', () => {
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
      goToStatsTab();
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
        goToStatsTab();
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
        goToStatsTab();
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
        goToStatsTab();
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

  // ── Score ────────────────────────────────────────────────────────────────

  it('shows correct score for a player: 1 regular fight no ko → score = 2', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-sc-admin', role: 'admin' },
      {
        discord_token: 'stat-sc-owner',
        game_pseudo: 'ScOwner',
        create_alliance: { name: 'ScAlliance', tag: 'SC1' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-sc-admin'].access_token;
      const ownerToken = users['stat-sc-owner'].access_token;
      const allianceId = users['stat-sc-owner'].alliance_id!;
      const ownerAccId = users['stat-sc-owner'].account_id!;

      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 0);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        cy.apiLogin(users['stat-sc-owner'].user_id);
        goToStatsTab();
        // 1 regular fight, 0 kos → score = 0*(-10) + 1*2 = 2
        cy.getByCy('statistics-table').find('tbody tr').first().contains('2').should('exist');
      });
    });
  });

  it('shows negative score when player has kos: 1 fight 1 ko → score = -8', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-scko-admin', role: 'admin' },
      {
        discord_token: 'stat-scko-owner',
        game_pseudo: 'ScKoOwner',
        create_alliance: { name: 'ScKoAlliance', tag: 'SKO' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['stat-scko-admin'].access_token;
      const ownerToken = users['stat-scko-owner'].access_token;
      const allianceId = users['stat-scko-owner'].alliance_id!;
      const ownerAccId = users['stat-scko-owner'].account_id!;

      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 1);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        cy.apiLogin(users['stat-scko-owner'].user_id);
        goToStatsTab();
        // 1 fight, 1 ko → score = 1*(-10) + 1*2 = -8
        cy.getByCy('statistics-table').find('tbody tr').first().contains('-8').should('exist');
      });
    });
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
        goToStatsTab();
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
        goToStatsTab();
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
        goToStatsTab();
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
        goToStatsTab();
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
        goToStatsTab();
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
        goToStatsTab();
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
        goToStatsTab();
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
        goToStatsTab();
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
          goToStatsTab();
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
        goToStatsTab();
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
          goToStatsTab();

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
          goToStatsTab();

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
          goToStatsTab();
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

  // ── War participation stats ───────────────────────────────────────────────────

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
        goToStatsTab();
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
        goToStatsTab();
        cy.getByCy('statistics-table')
          .find('tbody tr')
          .first()
          .within(() => {
            cy.contains('1.0').should('exist');
          });
      });
    });
  });

  // ── Member filter ─────────────────────────────────────────────────────────────

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
          goToStatsTab();
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
          goToStatsTab();
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
          goToStatsTab();
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
          goToStatsTab();

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
      goToStatsTab();
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
