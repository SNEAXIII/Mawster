import {
  addStatsForPlayer,
  openStatsAs,
  removeAllianceMember,
  selectMemberFilter,
  setupEndedAssistWar,
  setupStatsOwner,
  setupStatsOwnerAndMember,
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
    setupStatsOwner('stat-wp').then(({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId }) => {
      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 0);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        openStatsAs(ownerUserId);
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

  it('shows AVG MB/B average of 1.0 after one boss fight in one war', () => {
    setupStatsOwner('stat-bm').then(({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId }) => {
      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 50, 0);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        openStatsAs(ownerUserId);
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
    setupStatsOwnerAndMember('stat-fm').then(
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
            addStatsForPlayer(ownerToken, allianceId, warId, champId, cuOwnerId, 10, 0);
            addStatsForPlayer(ownerToken, allianceId, warId, champId, cuMemberId, 11, 0);
            cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
            removeAllianceMember(ownerToken, allianceId, memberAccId);
            openStatsAs(ownerUserId);
            // default current filter → only owner visible
            cy.getByCy('statistics-table').find('tbody tr').should('have.length', 1);
            cy.contains(memberPseudo).should('not.exist');
            // switch to all → both visible
            selectMemberFilter('All members');
            cy.getByCy('statistics-table').find('tbody tr').should('have.length', 2);
            cy.contains(memberPseudo).should('exist');
          },
        );
      },
    );
  });

  it('former member shows logout icon; current member does not', () => {
    setupStatsOwnerAndMember('stat-icon').then(
      ({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId, memberToken, memberAccId }) => {
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
            removeAllianceMember(ownerToken, allianceId, memberAccId);
            openStatsAs(ownerUserId);
            selectMemberFilter('All members');
            cy.getByCy(`former-badge-${memberAccId}`).should('exist');
            cy.getByCy(`former-badge-${ownerAccId}`).should('not.exist');
          },
        );
      },
    );
  });

  it('former-members filter shows only former member', () => {
    setupStatsOwnerAndMember('stat-fonly').then(
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
            removeAllianceMember(ownerToken, allianceId, memberAccId);
            openStatsAs(ownerUserId);
            selectMemberFilter('Former members');
            cy.getByCy('statistics-table').find('tbody tr').should('have.length', 1);
            cy.contains(memberPseudo).should('exist');
            cy.contains(ownerPseudo).should('not.exist');
          },
        );
      },
    );
  });

  // ── Perspective filter ────────────────────────────────────────────────────

  it('defender perspective shows the attacked champion instead of the attacker', () => {
    setupStatsOwner('stat-pv').then(({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId }) => {
      // attacker = Iron Man, defender = Wolverine
      withWarScenarioDefender(adminToken, ownerToken, ownerAccId, allianceId, 'Enemy', ({ champ2Id, cuId, warId }) => {
        // Iron Man attacks Wolverine (deathless)
        cy.apiPlaceWarDefender(ownerToken, allianceId, warId, 1, 10, champ2Id, 7, 3, 0);
        cy.apiAssignWarAttacker(ownerToken, allianceId, warId, 1, 10, cuId);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);

        openStatsAs(ownerUserId);

        // default attacker perspective → Iron Man visible
        cy.contains('Iron Man').should('exist');
        cy.contains('Wolverine').should('not.exist');

        // switch to defender perspective → Wolverine visible
        cy.getByCy('chart-perspective-defender').click();
        cy.contains('Wolverine').should('exist');
        cy.contains('Iron Man').should('not.exist');
      });
    });
  });

  // ── Assist stats ──────────────────────────────────────────────────────────

  it('shows total_assists = 1 for assistor and 0.5 fights for both after an assisted combat', () => {
    setupStatsOwnerAndMember('stat-ast').then(
      ({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId, memberToken, memberAccId }) => {
        setupEndedAssistWar({ adminToken, ownerToken, ownerAccId, memberToken, memberAccId, allianceId });

        openStatsAs(ownerUserId);
        selectMemberFilter('All members');

        // Assisted player (owner): fights = 0.5
        cy.getByCy(`statistics-row-${ownerAccId}`).within(() => {
          cy.contains('0.5').should('exist');
        });

        // Assistor (member): assists = 1, fights = 0.5
        cy.getByCy(`statistics-row-${memberAccId}`).within(() => {
          cy.contains('1').should('exist');
          cy.contains('0.5').should('exist');
        });
      },
    );
  });
});
