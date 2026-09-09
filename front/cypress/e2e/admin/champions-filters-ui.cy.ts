import { setupAdmin } from '../../support/e2e';

describe('Admin — champions filter bar', () => {
  let adminToken: string;

  beforeEach(() => {
    cy.truncateDb();
    setupAdmin('champ-filters-admin').then(({ access_token, user_id }) => {
      adminToken = access_token;
      cy.apiLogin(user_id);
    });
  });

  function loadTwo() {
    return cy.apiLoadChampions(adminToken, [
      { name: 'Iron Man', cls: 'Tech', is_ascendable: true, has_prefight: true },
      { name: 'Wolverine', cls: 'Mutant', is_ascendable: false, has_prefight: false },
    ]);
  }

  it('counts the active filters on the trigger', () => {
    loadTwo().then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('champions-filter-trigger').should('not.contain.text', '(');

      cy.getByCy('champions-filter-trigger').click();
      cy.getByCy('champions-filter-is_ascendable').contains('button', 'Yes').click();
      cy.getByCy('champions-filter-trigger').should('contain.text', '(1)');

      cy.getByCy('champions-filter-has_prefight').contains('button', 'Yes').click();
      cy.getByCy('champions-filter-trigger').should('contain.text', '(2)');
    });
  });

  it('clears one filter from its chip without touching the others', () => {
    loadTwo().then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('champions-filter-trigger').click();
      cy.getByCy('champions-filter-is_ascendable').contains('button', 'Yes').click();
      cy.getByCy('champions-filter-has_prefight').contains('button', 'No').click();

      cy.getByCy('champions-active-filter-is_ascendable').should('be.visible');
      cy.getByCy('champions-active-filter-has_prefight').should('be.visible');

      cy.getByCy('champions-active-filter-has_prefight').click();
      cy.getByCy('champions-active-filter-has_prefight').should('not.exist');
      cy.getByCy('champions-active-filter-is_ascendable').should('be.visible');
      cy.getByCy('champions-filter-trigger').should('contain.text', '(1)');
    });
  });

  it('clears every filter at once and shows the whole list again', () => {
    loadTwo().then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('champions-filter-trigger').click();
      cy.getByCy('champions-filter-is_ascendable').contains('button', 'Yes').click();
      cy.getByCy('champion-row-Wolverine').should('not.exist');

      cy.getByCy('champions-clear-filters').click();
      cy.getByCy('champions-active-filter-is_ascendable').should('not.exist');
      cy.getByCy('champion-row-Iron Man').should('be.visible');
      cy.getByCy('champion-row-Wolverine').should('be.visible');
    });
  });
});
