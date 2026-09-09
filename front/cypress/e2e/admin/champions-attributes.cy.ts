import { setupAdmin } from '../../support/e2e';

describe('Admin — champion attribute pills', () => {
  let adminToken: string;

  beforeEach(() => {
    cy.truncateDb();
    setupAdmin('champ-attr-admin').then(({ access_token, user_id }) => {
      adminToken = access_token;
      cy.apiLogin(user_id);
    });
  });

  it('toggles 7-star availability and keeps it after a reload', () => {
    cy.apiLoadChampions(adminToken, [{ name: 'Iron Man', cls: 'Tech', is_7_stars_available: false }]).then(() => {
      cy.goToAdminChampionsTab();

      cy.getByCy('champion-attr-seven-stars-Iron Man').should('have.attr', 'aria-pressed', 'false');
      cy.getByCy('champion-attr-seven-stars-Iron Man').click();
      cy.getByCy('champion-attr-seven-stars-Iron Man').should('have.attr', 'aria-pressed', 'true');

      cy.reload();
      cy.getByCy('tab-champions').click();
      cy.getByCy('champion-attr-seven-stars-Iron Man').should('have.attr', 'aria-pressed', 'true');
    });
  });

  it('disables the saga pills when no season exists', () => {
    // Saga roles hang off a season; without one there is nothing to write to.
    cy.apiLoadChampions(adminToken, [{ name: 'Iron Man', cls: 'Tech' }]).then(() => {
      cy.goToAdminChampionsTab();

      cy.getByCy('champion-attr-saga-attacker-Iron Man').should('be.disabled');
      cy.getByCy('champion-attr-saga-defender-Iron Man').should('be.disabled');
      cy.getByCy('champion-attr-ascendable-Iron Man').should('not.be.disabled');
    });
  });
});
