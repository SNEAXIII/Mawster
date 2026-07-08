import { addStatsForPlayer, withWarScenario } from '../alliances/statistics-helpers';

describe('Profile statistics tab', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows the empty state for a user with no game account', () => {
    cy.apiBatchSetup([{ discord_token: 'prof-bare', role: 'user' }]).then((users) => {
      cy.apiLogin(users['prof-bare'].user_id);
      cy.visit('/profile');
      cy.getByCy('profile-tab-stats').click();
      cy.getByCy('profile-stats-empty').should('exist');
    });
  });

  it('shows the stats card, season selector and charts after an ended war', () => {
    cy.apiBatchSetup([
      { discord_token: 'prof-admin', role: 'admin' },
      {
        discord_token: 'prof-owner',
        game_pseudo: 'ProfOwner',
        create_alliance: { name: 'ProfAlliance', tag: 'PRF' },
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminToken = users['prof-admin'].access_token;
      const ownerToken = users['prof-owner'].access_token;
      const allianceId = users['prof-owner'].alliance_id!;
      const ownerAccId = users['prof-owner'].account_id!;

      withWarScenario(
        adminToken,
        ownerToken,
        allianceId,
        ownerAccId,
        'Enemy',
        ({ champId, cuId, warId }) => {
          addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 1);
          cy.apiEndWar(ownerToken, allianceId, warId, true, 10);

          cy.apiLogin(users['prof-owner'].user_id);
          cy.visit('/profile');
          cy.getByCy('profile-tab-stats').click();

          cy.getByCy('profile-stats-tab').should('exist');
          cy.getByCy('profile-stats-card').should('exist');
          cy.getByCy('profile-season-select').should('exist');
          cy.getByCy('profile-evolution-chart').should('exist');
          // one ended war → the season appears in the selector
          cy.getByCy('profile-season-select').click();
          cy.getByCy('profile-season-64').should('exist');
        },
      );
    });
  });

  it('switches back to the info tab', () => {
    cy.apiBatchSetup([{ discord_token: 'prof-nav', role: 'user' }]).then((users) => {
      cy.apiLogin(users['prof-nav'].user_id);
      cy.visit('/profile');
      cy.getByCy('profile-tab-stats').click();
      // bare user (no game account) → stats tab renders the empty state
      cy.getByCy('profile-stats-empty').should('exist');
      cy.getByCy('profile-tab-infos').click();
      cy.getByCy('username-row').should('exist');
      cy.getByCy('profile-stats-empty').should('not.exist');
    });
  });
});
