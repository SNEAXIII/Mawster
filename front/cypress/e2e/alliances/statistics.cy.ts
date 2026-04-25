import { setupWarOwner, BACKEND, type UserSetupData } from '../../support/e2e';

// ── Helpers ────────────────────────────────────────────────────────────────

function activateSeason(adminToken: string, number = 64) {
  return cy
    .request({
      method: 'POST',
      url: `${BACKEND}/admin/seasons`,
      body: { number },
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    .then((res) =>
      cy
        .request({
          method: 'PATCH',
          url: `${BACKEND}/admin/seasons/${res.body.id}/activate`,
          headers: { Authorization: `Bearer ${adminToken}` },
        })
        .then(() => res.body as { id: string; number: number })
    );
}

interface StatScenario {
  adminToken: string;
  ownerData: UserSetupData;
  allianceId: string;
  ownerAccId: string;
  warId: string;
  championUserId: string;
}

function setupEndedWarWithStats(
  prefix: string,
  koCount = 0,
  nodeNumber = 10,
): Cypress.Chainable<StatScenario> {
  return setupWarOwner(prefix, `${prefix}Owner`, `${prefix}Alliance`, prefix.slice(0, 3).toUpperCase()).then(
    ({ adminData, ownerData, allianceId, ownerAccId }) => {
      return activateSeason(adminData.access_token).then(() =>
        cy.apiLoadChampion(adminData.access_token, 'Iron Man', 'Tech').then((champs: { id: string }[]) => {
          const champId = champs[0].id;
          return cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champId, '7r3')
            .then((cu: { id: string }) =>
              cy.apiCreateWar(ownerData.access_token, allianceId, 'Enemy').then((war: { id: string }) => {
                cy.apiPlaceWarDefender(ownerData.access_token, allianceId, war.id, 1, nodeNumber, champId, 7, 3, 0);
                cy.apiAssignWarAttacker(ownerData.access_token, allianceId, war.id, 1, nodeNumber, cu.id);
                if (koCount > 0) {
                  cy.apiUpdateWarKo(ownerData.access_token, allianceId, war.id, 1, nodeNumber, koCount);
                }
                cy.apiEndWar(ownerData.access_token, allianceId, war.id, true, 10);
                return cy.wrap({
                  adminToken: adminData.access_token,
                  ownerData,
                  allianceId,
                  ownerAccId,
                  warId: war.id,
                  championUserId: cu.id,
                });
              })
            );
        })
      );
    }
  );
}

function goToStatsTab() {
  cy.navTo('alliances');
  cy.getByCy('tab-statistics').click();
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Alliance Statistics', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Empty states ─────────────────────────────────────────────────────────

  it('shows empty state when no wars have been played', () => {
    setupWarOwner('stat-empty', 'EmptyOwner', 'EmptyAlliance', 'EMP').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      goToStatsTab();
      cy.getByCy('statistics-empty').should('be.visible');
    });
  });

  it('shows empty state when only an active (ongoing) war exists', () => {
    setupWarOwner('stat-active-war', 'ActiveOwner', 'ActiveAlliance', 'ACT').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        activateSeason(adminData.access_token).then(() => {
          cy.apiLoadChampion(adminData.access_token, 'Iron Man', 'Tech').then((champs: { id: string }[]) => {
            const champId = champs[0].id;
            cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champId, '7r3').then(
              (cu: { id: string }) => {
                cy.apiCreateWar(ownerData.access_token, allianceId, 'Enemy').then((war: { id: string }) => {
                  cy.apiPlaceWarDefender(ownerData.access_token, allianceId, war.id, 1, 10, champId, 7, 3, 0);
                  cy.apiAssignWarAttacker(ownerData.access_token, allianceId, war.id, 1, 10, cu.id);
                  // war NOT ended — stays active

                  cy.apiLogin(ownerData.user_id);
                  goToStatsTab();
                  cy.getByCy('statistics-empty').should('be.visible');
                });
              }
            );
          });
        });
      }
    );
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('shows statistics table after an ended war', () => {
    setupEndedWarWithStats('stat-happy', 0).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      goToStatsTab();
      cy.getByCy('statistics-table').should('be.visible');
      cy.getByCy('statistics-table').find('tbody tr').should('have.length', 1);
    });
  });

  it('shows correct fight count and ratio for a player', () => {
    setupEndedWarWithStats('stat-ratio', 1).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      goToStatsTab();
      cy.getByCy('statistics-table').find('tbody tr').first().within(() => {
        cy.contains('1').should('exist'); // total_fights
        cy.contains('0%').should('exist'); // ratio = (1 - 1/1) * 100
      });
    });
  });

  // ── Ratio filter ──────────────────────────────────────────────────────────

  it('hides players below ratio threshold', () => {
    setupEndedWarWithStats('stat-filter-ratio', 1).then(({ ownerData }) => {
      // player has ratio=0% (1 ko / 1 fight)
      cy.apiLogin(ownerData.user_id);
      goToStatsTab();
      cy.getByCy('statistics-table').should('be.visible');

      // filter to ratio ≥ 50 → player should disappear
      cy.getByCy('statistics-ratio-filter').click();
      cy.contains('Minimum ratio (%) ≥ 50%').click();
      cy.getByCy('statistics-empty-filtered').should('be.visible');
    });
  });

  it('shows reset button when filter is active and resets on click', () => {
    setupEndedWarWithStats('stat-reset', 1).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      goToStatsTab();

      cy.getByCy('statistics-reset-filters').should('not.exist');

      cy.getByCy('statistics-ratio-filter').click();
      cy.contains('Minimum ratio (%) ≥ 50%').click();
      cy.getByCy('statistics-reset-filters').should('be.visible').click();

      cy.getByCy('statistics-table').should('be.visible');
      cy.getByCy('statistics-reset-filters').should('not.exist');
    });
  });

  // ── Group filter ──────────────────────────────────────────────────────────

  it('filters by group when group is selected', () => {
    setupWarOwner('stat-grp', 'GrpOwner', 'GrpAlliance', 'GRP').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        // assign owner to group 1
        cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);

        activateSeason(adminData.access_token).then(() => {
          cy.apiLoadChampion(adminData.access_token, 'Iron Man', 'Tech').then((champs: { id: string }[]) => {
            const champId = champs[0].id;
            cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champId, '7r3').then(
              (cu: { id: string }) => {
                cy.apiCreateWar(ownerData.access_token, allianceId, 'Enemy').then((war: { id: string }) => {
                  cy.apiPlaceWarDefender(ownerData.access_token, allianceId, war.id, 1, 10, champId, 7, 3, 0);
                  cy.apiAssignWarAttacker(ownerData.access_token, allianceId, war.id, 1, 10, cu.id);
                  cy.apiEndWar(ownerData.access_token, allianceId, war.id, true, 10);

                  cy.apiLogin(ownerData.user_id);
                  goToStatsTab();
                  cy.getByCy('statistics-table').should('be.visible');

                  // filter to group 2 → player (group 1) disappears
                  cy.getByCy('statistics-group-filter').click();
                  cy.getByCy('statistics-group-option-2').click();
                  cy.getByCy('statistics-empty-filtered').should('be.visible');

                  // switch to group 1 → player reappears
                  cy.getByCy('statistics-group-filter').click();
                  cy.getByCy('statistics-group-option-1').click();
                  cy.getByCy('statistics-table').should('be.visible');
                });
              }
            );
          });
        });
      }
    );
  });
});
