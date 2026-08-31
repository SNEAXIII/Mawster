import {
  addStatsForPlayer,
  openStatsAs,
  setupStatsOwner,
  setupStatsOwnerAndMember,
  withWarScenario,
  withWarScenarioTwoPlayers,
  withWarScenarioDiffChampsPlayers,
  withWarScenarioTwoOwnerChamps,
  withTwoEndedWarsTwoPlayers,
  withTwoSeasonsOneWarEach,
} from './statistics-helpers';

describe('Alliance Statistics – Filters & Champion chart', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Ratio filter ──────────────────────────────────────────────────────────

  it('hides players below ratio threshold and shows empty-filtered state', () => {
    setupStatsOwner('stat-rf').then(({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId }) => {
      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 1);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        openStatsAs(ownerUserId);
        cy.getByCy('statistics-table').should('be.visible');
        cy.getByCy('statistics-ratio-filter').click();
        cy.contains('Minimum ratio ≥ 50%').click();
        cy.getByCy('statistics-empty-filtered').should('be.visible');
      });
    });
  });

  it('reset button appears when filter active and restores all rows', () => {
    setupStatsOwner('stat-rst').then(({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId }) => {
      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 1);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        openStatsAs(ownerUserId);
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
    setupStatsOwner('stat-click').then(({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId }) => {
      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        openStatsAs(ownerUserId);
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
    setupStatsOwner('stat-wf').then(({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId }) => {
      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Ended Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        cy.apiCreateWar(ownerToken, allianceId, 'Active Enemy');
        // active war — not ended, should NOT appear in war filter
        openStatsAs(ownerUserId);
        cy.getByCy('statistics-war-filter').click();
        cy.contains('Ended Enemy').should('be.visible');
        cy.contains('Active Enemy').should('not.exist');
      });
    });
  });

  it('war filter re-scopes the stats table, not only the chart', () => {
    setupStatsOwnerAndMember('stat-wft').then(
      ({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId, memberToken, memberAccId }) => {
        const ownerRow = `statistics-row-${ownerAccId}`;
        const memberRow = `statistics-row-${memberAccId}`;

        withTwoEndedWarsTwoPlayers(
          adminToken,
          ownerToken,
          ownerAccId,
          memberToken,
          memberAccId,
          allianceId,
          ({ warOneId, warTwoId }) => {
            openStatsAs(ownerUserId);

            // All wars → both players, each with their single fight.
            cy.getByCy('statistics-table').find('tbody tr').should('have.length', 2);
            cy.getByCy(ownerRow).should('exist');
            cy.getByCy(memberRow).should('exist');

            // WarOne → only the owner fought there.
            cy.getByCy('statistics-war-filter').click();
            cy.getByCy(`statistics-war-${warOneId}`).click();
            cy.getByCy('statistics-table').find('tbody tr').should('have.length', 1);
            cy.getByCy(ownerRow).should('exist');
            cy.getByCy(memberRow).should('not.exist');

            // WarTwo → only the member fought there, with the 2 KOs of that war.
            cy.getByCy('statistics-war-filter').click();
            cy.getByCy(`statistics-war-${warTwoId}`).click();
            cy.getByCy('statistics-table').find('tbody tr').should('have.length', 1);
            cy.getByCy(memberRow).should('exist');
            cy.getByCy(ownerRow).should('not.exist');

            // Back to all wars → the table widens again.
            cy.getByCy('statistics-war-filter').click();
            cy.getByCy('statistics-war-all').click();
            cy.getByCy('statistics-table').find('tbody tr').should('have.length', 2);
          },
        );
      },
    );
  });

  it('season filter switches the table to a past season and rescopes the wars', () => {
    setupStatsOwnerAndMember('stat-sf').then(
      ({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId, memberToken, memberAccId }) => {
        const ownerRow = `statistics-row-${ownerAccId}`;
        const memberRow = `statistics-row-${memberAccId}`;

        withTwoSeasonsOneWarEach(
          adminToken,
          ownerToken,
          ownerAccId,
          memberToken,
          memberAccId,
          allianceId,
          ({ pastSeasonId, currentSeasonId }) => {
            openStatsAs(ownerUserId);

            // Defaults to the newest season with data — only the member fought there.
            cy.getByCy('statistics-season-filter').should('contain', 'Season 64');
            cy.getByCy(memberRow).should('exist');
            cy.getByCy(ownerRow).should('not.exist');

            // Both seasons are offered, newest first.
            cy.getByCy('statistics-season-filter').click();
            cy.getByCy(`statistics-season-${currentSeasonId}`).should('be.visible');
            cy.getByCy(`statistics-season-${pastSeasonId}`).click();

            // Season 63 → the other player, with the KOs of that season's war.
            cy.getByCy('statistics-season-filter').should('contain', 'Season 63');
            cy.getByCy(ownerRow).should('exist');
            cy.getByCy(memberRow).should('not.exist');

            // The war dropdown follows the season: only that season's war is listed.
            cy.getByCy('statistics-war-filter').click();
            cy.contains('OldWar').should('be.visible');
            cy.contains('NewWar').should('not.exist');
          },
        );
      },
    );
  });

  it('keeps the filter bar reachable when a war filter empties the table', () => {
    setupStatsOwner('stat-wfe').then(({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId }) => {
      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Fought', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 0);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        // A second ended war nobody fought in: filtering on it yields zero rows.
        cy.apiCreateWar(ownerToken, allianceId, 'Empty').then((emptyWar: { id: string }) => {
          cy.apiEndWar(ownerToken, allianceId, emptyWar.id, true, 10);
          openStatsAs(ownerUserId);
          cy.getByCy('statistics-table').should('be.visible');

          cy.getByCy('statistics-war-filter').click();
          cy.getByCy(`statistics-war-${emptyWar.id}`).click();

          // No rows, but the filters must stay on screen or the filter is a dead end.
          cy.getByCy('statistics-empty-filtered').should('be.visible');
          cy.getByCy('statistics-war-filter').should('be.visible');
          cy.getByCy('statistics-reset-filters').should('be.visible').click();
          cy.getByCy('statistics-table').should('be.visible');
        });
      });
    });
  });

  it('chart metric toggle switches between deathless, all and kos', () => {
    setupStatsOwner('stat-cm').then(({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId }) => {
      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 1);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        openStatsAs(ownerUserId);
        cy.getByCy('chart-metric-deathless').should('not.have.attr', 'data-variant', 'outline');
        cy.getByCy('chart-metric-kos').click();
        cy.getByCy('chart-metric-kos').should('not.have.attr', 'data-variant', 'outline');
        cy.getByCy('chart-metric-all').click();
        cy.getByCy('chart-metric-all').should('not.have.attr', 'data-variant', 'outline');
      });
    });
  });

  it('see detail button opens the champion detail modal', () => {
    setupStatsOwner('stat-modal').then(({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId }) => {
      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        openStatsAs(ownerUserId);
        cy.getByCy('champion-detail-modal').should('not.exist');
        cy.getByCy('chart-see-detail').click();
        cy.getByCy('champion-detail-modal').should('be.visible');
        cy.getByCy('champion-detail-modal').contains('Iron Man').should('exist');
      });
    });
  });

  it('clicking the same row again deselects the player', () => {
    setupStatsOwner('stat-tog').then(({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId }) => {
      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        openStatsAs(ownerUserId);
        cy.getByCy(`statistics-row-${ownerAccId}`).click();
        cy.getByCy(`statistics-row-${ownerAccId}`).should('have.class', 'bg-muted');
        cy.getByCy(`statistics-row-${ownerAccId}`).click();
        cy.getByCy(`statistics-row-${ownerAccId}`).should('not.have.class', 'bg-muted');
        cy.getByCy('statistics-reset-filters').should('not.exist');
      });
    });
  });

  it('reset button resets war filter back to all wars', () => {
    setupStatsOwner('stat-wfr').then(({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId }) => {
      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'War1', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        openStatsAs(ownerUserId);
        cy.getByCy('statistics-war-filter').click();
        cy.getByCy(`statistics-war-${warId}`).click();
        cy.getByCy('statistics-reset-filters').should('be.visible').click();
        cy.getByCy('statistics-war-filter').should('contain', 'All wars');
      });
    });
  });

  it('clicking a row shows that player name in the chart area', () => {
    setupStatsOwnerAndMember('stat-pname').then(
      ({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId, memberToken, memberAccId, memberPseudo }) => {
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
            openStatsAs(ownerUserId);
            cy.getByCy(`statistics-row-${memberAccId}`).click();
            cy.contains(memberPseudo).should('be.visible');
          },
        );
      },
    );
  });

  it('champion detail modal closes and can sort by KOs', () => {
    setupStatsOwner('stat-mds').then(({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId }) => {
      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 1);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        openStatsAs(ownerUserId);
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
    // owner → G1 (battlegroup 1), member → G2 (battlegroup 2)
    setupStatsOwnerAndMember('stat-grc', 2).then(
      ({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId, memberToken, memberAccId }) => {
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

            openStatsAs(ownerUserId);

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
      },
    );
  });

  // ── Deathless filter ─────────────────────────────────────────────────────

  it('deathless metric shows only ko_count=0 fights by default, all shows both', () => {
    setupStatsOwner('stat-dl').then(({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId }) => {
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

          openStatsAs(ownerUserId);

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
    // owner → G1 (battlegroup 1), member → G2 (battlegroup 2)
    setupStatsOwnerAndMember('stat-grp', 2).then(
      ({
        adminToken,
        ownerToken,
        ownerUserId,
        ownerAccId,
        ownerPseudo,
        allianceId,
        memberToken,
        memberAccId,
        memberPseudo,
      }) => {
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

            openStatsAs(ownerUserId);
            cy.getByCy('statistics-table').find('tbody tr').should('have.length', 2);

            // filter to G1 → only owner visible
            cy.getByCy('statistics-group-filter').click();
            cy.contains('G1').click();
            cy.getByCy('statistics-table').find('tbody tr').should('have.length', 1);
            cy.contains(ownerPseudo).should('exist');

            // filter to G2 → only member visible
            cy.getByCy('statistics-group-filter').click();
            cy.contains('G2').click();
            cy.getByCy('statistics-table').find('tbody tr').should('have.length', 1);
            cy.contains(memberPseudo).should('exist');
          },
        );
      },
    );
  });
});
