import { addStatsForPlayer, openStatsAs, setupStatsOwner, withWarScenario } from './statistics-helpers';

describe('Alliance Statistics – Empty states & Happy path', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Empty states ──────────────────────────────────────────────────────────

  it('shows empty state when no wars have been played', () => {
    setupStatsOwner('stat-empty').then(({ ownerUserId }) => {
      openStatsAs(ownerUserId);
      cy.getByCy('statistics-empty').should('be.visible');
    });
  });

  it('shows empty state when only an active (ongoing) war exists', () => {
    setupStatsOwner('stat-act').then(({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId }) => {
      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10);
        // war NOT ended — stays active
        openStatsAs(ownerUserId);
        cy.getByCy('statistics-empty').should('be.visible');
      });
    });
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('shows statistics table after an ended war', () => {
    setupStatsOwner('stat-hp').then(({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId }) => {
      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        openStatsAs(ownerUserId);
        cy.getByCy('statistics-table').should('be.visible');
        cy.getByCy('statistics-table').find('tbody tr').should('have.length', 1);
      });
    });
  });

  it('shows correct fight count and ratio for a player with a KO', () => {
    setupStatsOwner('stat-ko').then(({ adminToken, ownerToken, ownerUserId, ownerAccId, allianceId }) => {
      withWarScenario(adminToken, ownerToken, allianceId, ownerAccId, 'Enemy', ({ champId, cuId, warId }) => {
        addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 1);
        cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
        openStatsAs(ownerUserId);
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
