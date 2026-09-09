import { setupAdmin } from '../../support/e2e';

describe('Admin — per-season saga classification', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('sets saga attacker for the current season and persists on reload', () => {
    setupAdmin('saga-attacker-admin').then(({ access_token, user_id }) => {
      cy.apiCreateSeason(access_token, 30);
      cy.apiLoadChampion(access_token, 'Iron Man', 'Tech');
      cy.apiLogin(user_id);
      cy.goToAdminChampionsTab();

      cy.getByCy('champion-attr-saga-attacker-Iron Man').should('have.attr', 'aria-pressed', 'false');
      cy.getByCy('champion-attr-saga-attacker-Iron Man').click();
      cy.getByCy('champion-attr-saga-attacker-Iron Man').should('have.attr', 'aria-pressed', 'true');

      cy.reload();
      cy.getByCy('tab-champions').click();
      cy.getByCy('champion-attr-saga-attacker-Iron Man').should('have.attr', 'aria-pressed', 'true');
    });
  });

  it('does not carry a saga role over to another season', () => {
    setupAdmin('saga-isolation-admin').then(({ access_token, user_id }) => {
      cy.apiCreateSeason(access_token, 32).then((first) => {
        const firstSeasonId = first.body.id as string;
        cy.apiLoadChampion(access_token, 'Iron Man', 'Tech');
        cy.apiLogin(user_id);
        cy.goToAdminChampionsTab();

        cy.getByCy('champion-attr-saga-attacker-Iron Man').click();
        cy.getByCy('champion-attr-saga-attacker-Iron Man').should('have.attr', 'aria-pressed', 'true');

        // Only one season may be current, so the first is closed before the next.
        cy.apiCloseSeason(access_token, firstSeasonId);
        cy.apiCreateSeason(access_token, 33);
        cy.reload();
        cy.getByCy('tab-champions').click();

        cy.getByCy('admin-saga-season-select').click();
        cy.contains('[role="option"]', '33').click();
        cy.getByCy('champion-attr-saga-attacker-Iron Man').should('have.attr', 'aria-pressed', 'false');
      });
    });
  });

  it('sets saga defender for the current season', () => {
    setupAdmin('saga-defender-admin').then(({ access_token, user_id }) => {
      cy.apiCreateSeason(access_token, 31);
      cy.apiLoadChampion(access_token, 'Wolverine', 'Mutant');
      cy.apiLogin(user_id);
      cy.goToAdminChampionsTab();

      cy.getByCy('champion-attr-saga-defender-Wolverine').should('have.attr', 'aria-pressed', 'false');
      cy.getByCy('champion-attr-saga-defender-Wolverine').click();
      cy.getByCy('champion-attr-saga-defender-Wolverine').should('have.attr', 'aria-pressed', 'true');
    });
  });
});
