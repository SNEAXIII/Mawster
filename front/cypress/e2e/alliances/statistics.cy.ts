import { BACKEND } from '../../support/e2e';

describe('Alliance Statistics', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  function createAndActivateSeason(adminToken: string) {
    return cy
      .request({
        method: 'POST',
        url: `${BACKEND}/admin/seasons`,
        body: { number: 64 },
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      .then((res) =>
        cy.request({
          method: 'PATCH',
          url: `${BACKEND}/admin/seasons/${res.body.id}/activate`,
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      );
  }

  function setupWarWithAttacker(
    ownerToken: string,
    allianceId: string,
    champId: string,
    championUserId: string,
    nodeNumber = 10,
    koCount = 0,
  ) {
    return cy.apiCreateWar(ownerToken, allianceId, 'Enemy').then((war: { id: string }) => {
      cy.apiPlaceWarDefender(ownerToken, allianceId, war.id, 1, nodeNumber, champId, 7, 3, 0);
      cy.apiAssignWarAttacker(ownerToken, allianceId, war.id, 1, nodeNumber, championUserId);
      if (koCount > 0) cy.apiUpdateWarKo(ownerToken, allianceId, war.id, 1, nodeNumber, koCount);
      return cy.wrap(war);
    });
  }

  function goToStatsTab() {
    cy.navTo('alliances');
    cy.getByCy('tab-statistics').click();
  }

  // ── Empty states ──────────────────────────────────────────────────────────

  it('shows empty state when no wars have been played', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-empty-owner', game_pseudo: 'EmptyOwner', create_alliance: { name: 'EmptyAlliance', tag: 'EMP' } },
    ]).then((users) => {
      cy.apiLogin(users['stat-empty-owner'].user_id);
      goToStatsTab();
      cy.getByCy('statistics-empty').should('be.visible');
    });
  });

  it('shows empty state when only an active (ongoing) war exists', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-act-admin', role: 'admin' },
      { discord_token: 'stat-act-owner', game_pseudo: 'ActiveOwner', create_alliance: { name: 'ActiveAlliance', tag: 'ACT' } },
    ]).then((users) => {
      const adminToken = users['stat-act-admin'].access_token;
      const ownerToken = users['stat-act-owner'].access_token;
      const allianceId = users['stat-act-owner'].alliance_id!;
      const ownerAccId = users['stat-act-owner'].account_id!;

      createAndActivateSeason(adminToken).then(() => {
        cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs: { id: string }[]) => {
          cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs[0].id, '7r3').then((cu: { id: string }) => {
            cy.apiCreateWar(ownerToken, allianceId, 'Enemy').then((war: { id: string }) => {
              cy.apiPlaceWarDefender(ownerToken, allianceId, war.id, 1, 10, champs[0].id, 7, 3, 0);
              cy.apiAssignWarAttacker(ownerToken, allianceId, war.id, 1, 10, cu.id);
              // war NOT ended — stays active

              cy.apiLogin(users['stat-act-owner'].user_id);
              goToStatsTab();
              cy.getByCy('statistics-empty').should('be.visible');
            });
          });
        });
      });
    });
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('shows statistics table after an ended war', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-hp-admin', role: 'admin' },
      { discord_token: 'stat-hp-owner', game_pseudo: 'HpOwner', create_alliance: { name: 'HpAlliance', tag: 'HP1' } },
    ]).then((users) => {
      const adminToken = users['stat-hp-admin'].access_token;
      const ownerToken = users['stat-hp-owner'].access_token;
      const allianceId = users['stat-hp-owner'].alliance_id!;
      const ownerAccId = users['stat-hp-owner'].account_id!;

      createAndActivateSeason(adminToken).then(() => {
        cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs: { id: string }[]) => {
          cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs[0].id, '7r3').then((cu: { id: string }) => {
            setupWarWithAttacker(ownerToken, allianceId, champs[0].id, cu.id).then((war) => {
              cy.apiEndWar(ownerToken, allianceId, war.id, true, 10);

              cy.apiLogin(users['stat-hp-owner'].user_id);
              goToStatsTab();
              cy.getByCy('statistics-table').should('be.visible');
              cy.getByCy('statistics-table').find('tbody tr').should('have.length', 1);
            });
          });
        });
      });
    });
  });

  it('shows correct fight count and ratio for a player with a KO', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-ko-admin', role: 'admin' },
      { discord_token: 'stat-ko-owner', game_pseudo: 'KoOwner', create_alliance: { name: 'KoAlliance', tag: 'KO1' } },
    ]).then((users) => {
      const adminToken = users['stat-ko-admin'].access_token;
      const ownerToken = users['stat-ko-owner'].access_token;
      const allianceId = users['stat-ko-owner'].alliance_id!;
      const ownerAccId = users['stat-ko-owner'].account_id!;

      createAndActivateSeason(adminToken).then(() => {
        cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs: { id: string }[]) => {
          cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs[0].id, '7r3').then((cu: { id: string }) => {
            setupWarWithAttacker(ownerToken, allianceId, champs[0].id, cu.id, 10, 1).then((war) => {
              cy.apiEndWar(ownerToken, allianceId, war.id, true, 10);

              cy.apiLogin(users['stat-ko-owner'].user_id);
              goToStatsTab();
              cy.getByCy('statistics-table').find('tbody tr').first().within(() => {
                cy.contains('1').should('exist'); // total_fights
                cy.contains('0%').should('exist'); // ratio = (1 - 1/1) * 100
              });
            });
          });
        });
      });
    });
  });

  // ── Ratio filter ──────────────────────────────────────────────────────────

  it('hides players below ratio threshold and shows empty-filtered state', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-rf-admin', role: 'admin' },
      { discord_token: 'stat-rf-owner', game_pseudo: 'RfOwner', create_alliance: { name: 'RfAlliance', tag: 'RF1' } },
    ]).then((users) => {
      const adminToken = users['stat-rf-admin'].access_token;
      const ownerToken = users['stat-rf-owner'].access_token;
      const allianceId = users['stat-rf-owner'].alliance_id!;
      const ownerAccId = users['stat-rf-owner'].account_id!;

      createAndActivateSeason(adminToken).then(() => {
        cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs: { id: string }[]) => {
          cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs[0].id, '7r3').then((cu: { id: string }) => {
            setupWarWithAttacker(ownerToken, allianceId, champs[0].id, cu.id, 10, 1).then((war) => {
              cy.apiEndWar(ownerToken, allianceId, war.id, true, 10);

              cy.apiLogin(users['stat-rf-owner'].user_id);
              goToStatsTab();
              cy.getByCy('statistics-table').should('be.visible');

              cy.getByCy('statistics-ratio-filter').click();
              cy.contains('Minimum ratio (%) ≥ 50%').click();
              cy.getByCy('statistics-empty-filtered').should('be.visible');
            });
          });
        });
      });
    });
  });

  it('reset button appears when filter active and restores all rows', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-rst-admin', role: 'admin' },
      { discord_token: 'stat-rst-owner', game_pseudo: 'RstOwner', create_alliance: { name: 'RstAlliance', tag: 'RST' } },
    ]).then((users) => {
      const adminToken = users['stat-rst-admin'].access_token;
      const ownerToken = users['stat-rst-owner'].access_token;
      const allianceId = users['stat-rst-owner'].alliance_id!;
      const ownerAccId = users['stat-rst-owner'].account_id!;

      createAndActivateSeason(adminToken).then(() => {
        cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs: { id: string }[]) => {
          cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs[0].id, '7r3').then((cu: { id: string }) => {
            setupWarWithAttacker(ownerToken, allianceId, champs[0].id, cu.id, 10, 1).then((war) => {
              cy.apiEndWar(ownerToken, allianceId, war.id, true, 10);

              cy.apiLogin(users['stat-rst-owner'].user_id);
              goToStatsTab();

              cy.getByCy('statistics-reset-filters').should('not.exist');
              cy.getByCy('statistics-ratio-filter').click();
              cy.contains('Minimum ratio (%) ≥ 50%').click();
              cy.getByCy('statistics-reset-filters').should('be.visible').click();
              cy.getByCy('statistics-table').should('be.visible');
              cy.getByCy('statistics-reset-filters').should('not.exist');
            });
          });
        });
      });
    });
  });

  // ── Group filter ──────────────────────────────────────────────────────────

  it('filters by group and shows correct players per group', () => {
    cy.apiBatchSetup([
      { discord_token: 'stat-grp-admin', role: 'admin' },
      { discord_token: 'stat-grp-owner', game_pseudo: 'GrpOwner', create_alliance: { name: 'GrpAlliance', tag: 'GRP' } },
    ]).then((users) => {
      const adminToken = users['stat-grp-admin'].access_token;
      const ownerToken = users['stat-grp-owner'].access_token;
      const allianceId = users['stat-grp-owner'].alliance_id!;
      const ownerAccId = users['stat-grp-owner'].account_id!;

      cy.apiSetMemberGroup(ownerToken, allianceId, ownerAccId, 1);

      createAndActivateSeason(adminToken).then(() => {
        cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs: { id: string }[]) => {
          cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs[0].id, '7r3').then((cu: { id: string }) => {
            setupWarWithAttacker(ownerToken, allianceId, champs[0].id, cu.id).then((war) => {
              cy.apiEndWar(ownerToken, allianceId, war.id, true, 10);

              cy.apiLogin(users['stat-grp-owner'].user_id);
              goToStatsTab();
              cy.getByCy('statistics-table').should('be.visible');

              // player is in G1 — filter to G2 should show empty
              cy.getByCy('statistics-group-filter').click();
              cy.getByCy('statistics-group-option-2').click();
              cy.getByCy('statistics-empty-filtered').should('be.visible');

              // switch to G1 — player reappears
              cy.getByCy('statistics-group-filter').click();
              cy.getByCy('statistics-group-option-1').click();
              cy.getByCy('statistics-table').should('be.visible');
            });
          });
        });
      });
    });
  });
});
