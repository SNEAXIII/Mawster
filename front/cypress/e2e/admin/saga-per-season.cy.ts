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

      cy.getByCy('toggle-saga-attacker-Iron Man').should('contain.text', 'No');
      cy.getByCy('toggle-saga-attacker-Iron Man').click();
      cy.getByCy('toggle-saga-attacker-Iron Man').should('contain.text', 'Yes');

      cy.reload();
      cy.getByCy('tab-champions').click();
      cy.getByCy('toggle-saga-attacker-Iron Man').should('contain.text', 'Yes');
    });
  });

  it('sets saga defender for the current season', () => {
    setupAdmin('saga-defender-admin').then(({ access_token, user_id }) => {
      cy.apiCreateSeason(access_token, 31);
      cy.apiLoadChampion(access_token, 'Wolverine', 'Mutant');
      cy.apiLogin(user_id);
      cy.goToAdminChampionsTab();

      cy.getByCy('toggle-saga-defender-Wolverine').should('contain.text', 'No');
      cy.getByCy('toggle-saga-defender-Wolverine').click();
      cy.getByCy('toggle-saga-defender-Wolverine').should('contain.text', 'Yes');
    });
  });
});
