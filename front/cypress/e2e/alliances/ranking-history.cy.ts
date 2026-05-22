import { setupWarOwner, BACKEND, createAndActivateSeason } from '../../support/e2e';

function goToStatsTab() {
  cy.navTo('alliances');
  cy.getByCy('tab-statistics').click();
}

function openRankingHistory() {
  cy.getByCy('collapsible-ranking-history').click();
}

function createAndEndTwoWars(ownerToken: string, allianceId: string, cb: () => void) {
  cy.apiCreateWar(ownerToken, allianceId, 'Enemy1').then((war1: { id: string }) => {
    cy.apiEndWar(ownerToken, allianceId, war1.id, true, 50).then(() => {
      cy.apiCreateWar(ownerToken, allianceId, 'Enemy2').then((war2: { id: string }) => {
        cy.apiEndWar(ownerToken, allianceId, war2.id, false, -30).then(cb);
      });
    });
  });
}

describe('Alliance Statistics – Ranking History', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows empty state when no wars this season', () => {
    setupWarOwner('rh-empty', 'RhOwner', 'RhAlliance', 'RHA').then(({ adminData, ownerData, allianceId }) => {
      createAndActivateSeason(adminData.access_token).then(() => {
        cy.apiLogin(ownerData.user_id);
        goToStatsTab();
        cy.getByCy('collapsible-ranking-history').should('be.visible');
        openRankingHistory();
        cy.getByCy('ranking-history-empty').should('be.visible');
      });
    });
  });

  it('shows chart with data points after ended wars', () => {
    setupWarOwner('rh-wars', 'RhWarOwner', 'RhWarAlliance', 'RHW').then(({ adminData, ownerData, allianceId }) => {
      createAndActivateSeason(adminData.access_token).then(() => {
        createAndEndTwoWars(ownerData.access_token, allianceId, () => {
          cy.apiLogin(ownerData.user_id);
          goToStatsTab();
          openRankingHistory();
          cy.getByCy('ranking-history-chart').should('be.visible');
        });
      });
    });
  });

  it('collapsible can be closed and reopened', () => {
    setupWarOwner('rh-toggle', 'RhToggle', 'RhToggleAlliance', 'RHT').then(({ adminData, ownerData, allianceId }) => {
      createAndActivateSeason(adminData.access_token).then(() => {
        cy.apiLogin(ownerData.user_id);
        goToStatsTab();
        cy.getByCy('collapsible-ranking-history').should('be.visible');
        openRankingHistory();
        cy.getByCy('ranking-history-empty').should('be.visible');
        openRankingHistory();
        cy.getByCy('ranking-history-empty').should('not.exist');
      });
    });
  });
});
