import { setupAdmin, BACKEND } from '../../support/e2e';

describe('Admin — champions list & filters', () => {
  let adminToken: string;

  beforeEach(() => {
    cy.truncateDb();
    setupAdmin('champ-list-admin').then(({ access_token, user_id }) => {
      adminToken = access_token;
      cy.apiLogin(user_id);
    });
  });

  it('champion appears in list after load', () => {
    cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('champions-list').should('be.visible');
      cy.getByCy('champion-row-Iron Man').should('be.visible');
    });
  });

  it('filter by class shows only matching champions', () => {
    cy.apiLoadChampions(adminToken, [
      { name: 'Iron Man', cls: 'Tech' },
      { name: 'Wolverine', cls: 'Mutant' },
    ]).then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('filter-class').click();
      cy.contains('[role="menuitemradio"]', 'Tech').click();
      cy.getByCy('champion-row-Iron Man').should('be.visible');
      cy.getByCy('champion-row-Wolverine').should('not.exist');
    });
  });

  it('filter by has_prefight=Yes shows only prefight champions', () => {
    cy.apiLoadChampions(adminToken, [
      { name: 'Iron Man', cls: 'Tech', has_prefight: true },
      { name: 'Wolverine', cls: 'Mutant', has_prefight: false },
    ]).then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('filter-prefight').click();
      cy.contains('[role="menuitemradio"]', 'Yes').click();
      cy.getByCy('champion-row-Iron Man').should('be.visible');
      cy.getByCy('champion-row-Wolverine').should('not.exist');
    });
  });

  it('filter by is_ascendable=Yes shows only ascendable champions', () => {
    cy.apiLoadChampions(adminToken, [
      { name: 'Iron Man', cls: 'Tech', is_ascendable: true },
      { name: 'Wolverine', cls: 'Mutant', is_ascendable: false },
    ]).then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('filter-ascendable').click();
      cy.contains('[role="menuitemradio"]', 'Yes').click();
      cy.getByCy('champion-row-Iron Man').should('be.visible');
      cy.getByCy('champion-row-Wolverine').should('not.exist');
    });
  });

  // Saga attacker/defender filters were removed — saga roles are now
  // scoped to a selected season (see admin/saga-per-season.cy.ts).

  it('search by name filters to matching champion', () => {
    cy.apiLoadChampions(adminToken, [
      { name: 'Iron Man', cls: 'Tech' },
      { name: 'Wolverine', cls: 'Mutant' },
    ]).then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('champion-search').type('Iron');
      cy.getByCy('champion-row-Iron Man').should('be.visible');
      cy.getByCy('champion-row-Wolverine').should('not.exist');
    });
  });

  it('reset class filter shows all champions', () => {
    cy.apiLoadChampions(adminToken, [
      { name: 'Iron Man', cls: 'Tech' },
      { name: 'Wolverine', cls: 'Mutant' },
    ]).then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('filter-class').click();
      cy.contains('[role="menuitemradio"]', 'Tech').click();
      cy.getByCy('champion-row-Wolverine').should('not.exist');
      cy.getByCy('filter-class').click();
      cy.contains('[role="menuitemradio"]', 'All').click({ force: true });
      cy.getByCy('champion-row-Iron Man').should('be.visible');
      cy.getByCy('champion-row-Wolverine').should('be.visible');
    });
  });
});
