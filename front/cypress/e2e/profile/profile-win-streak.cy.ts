import { addStatsForPlayer, withWarScenario } from '../alliances/statistics-helpers';

function openProfileStats(userId: string) {
  cy.apiLogin(userId, 'profile');
  cy.getByCy('profile-tab-stats').click();
  cy.getByCy('profile-stats-card').should('exist');
}

describe('Profile win streak', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('counts every fight of an unbroken chain', () => {
    withWarScenario('streak-ok', 'Enemy').then(({ ownerToken, ownerUserId, allianceId, champId, cuId, warId }) => {
      [1, 2, 3].forEach((node) => addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, node, 0));
      cy.apiEndWar(ownerToken, allianceId, warId, true, 10);

      openProfileStats(ownerUserId);
      cy.getByCy('profile-win-streak-count').should('have.text', '3');
    });
  });

  it('restarts after a KO, counting only the later nodes', () => {
    withWarScenario('streak-ko', 'Enemy').then(({ ownerToken, ownerUserId, allianceId, champId, cuId, warId }) => {
      addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 1, 0);
      addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 2, 1);
      addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 3, 0);
      cy.apiEndWar(ownerToken, allianceId, warId, true, 10);

      openProfileStats(ownerUserId);
      cy.getByCy('profile-win-streak-count').should('have.text', '1');
    });
  });

  it('breaks on a fight flagged not done', () => {
    withWarScenario('streak-nd', 'Enemy').then(({ ownerToken, ownerUserId, allianceId, champId, cuId, warId }) => {
      [1, 2, 3].forEach((node) => addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, node, 0));
      cy.apiToggleFightNotDone(ownerToken, allianceId, warId, 1, 3);
      cy.apiEndWar(ownerToken, allianceId, warId, true, 10);

      openProfileStats(ownerUserId);
      cy.getByCy('profile-win-streak-count').should('have.text', '0');
    });
  });

  it('chains across two wars in date order', () => {
    withWarScenario('streak-wars', 'First').then(({ ownerToken, ownerUserId, allianceId, champId, cuId, warId }) => {
      addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 1, 2);
      addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 2, 0);
      cy.apiEndWar(ownerToken, allianceId, warId, true, 10);

      cy.apiCreateWar(ownerToken, allianceId, 'Second').then((second: { id: string }) => {
        [1, 2].forEach((node) => addStatsForPlayer(ownerToken, allianceId, second.id, champId, cuId, node, 0));
        cy.apiEndWar(ownerToken, allianceId, second.id, true, 10);
      });

      openProfileStats(ownerUserId);
      cy.getByCy('profile-win-streak-count').should('have.text', '3');
    });
  });
});
