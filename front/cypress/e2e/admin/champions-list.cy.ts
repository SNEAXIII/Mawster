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
      cy.navTo('admin');
      cy.getByCy('tab-champions').click();
      cy.getByCy('champions-list').should('be.visible');
      cy.getByCy('champion-row-Iron Man').should('be.visible');
    });
  });

  it('filter by class shows only matching champions', () => {
    cy.apiLoadChampions(adminToken, [
      { name: 'Iron Man', cls: 'Tech' },
      { name: 'Wolverine', cls: 'Mutant' },
    ]).then(() => {
      cy.navTo('admin');
      cy.getByCy('tab-champions').click();
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
      cy.navTo('admin');
      cy.getByCy('tab-champions').click();
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
      cy.navTo('admin');
      cy.getByCy('tab-champions').click();
      cy.getByCy('filter-ascendable').click();
      cy.contains('[role="menuitemradio"]', 'Yes').click();
      cy.getByCy('champion-row-Iron Man').should('be.visible');
      cy.getByCy('champion-row-Wolverine').should('not.exist');
    });
  });

  it('filter by is_saga_attacker=Yes shows only saga attackers', () => {
    cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech', { is_saga_attacker: true }).then(() => {
      cy.apiLoadChampion(adminToken, 'Wolverine', 'Mutant').then(() => {
        cy.navTo('admin');
        cy.getByCy('tab-champions').click();
        cy.getByCy('filter-saga-attacker').click();
        cy.contains('[role="menuitemradio"]', 'Yes').click();
        cy.getByCy('champion-row-Iron Man').should('be.visible');
        cy.getByCy('champion-row-Wolverine').should('not.exist');
      });
    });
  });

  it('filter by is_saga_defender=Yes shows only saga defenders', () => {
    cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech', { is_saga_defender: true }).then(() => {
      cy.apiLoadChampion(adminToken, 'Wolverine', 'Mutant').then(() => {
        cy.navTo('admin');
        cy.getByCy('tab-champions').click();
        cy.getByCy('filter-saga-defender').click();
        cy.contains('[role="menuitemradio"]', 'Yes').click();
        cy.getByCy('champion-row-Iron Man').should('be.visible');
        cy.getByCy('champion-row-Wolverine').should('not.exist');
      });
    });
  });

  it('search by name filters to matching champion', () => {
    cy.apiLoadChampions(adminToken, [
      { name: 'Iron Man', cls: 'Tech' },
      { name: 'Wolverine', cls: 'Mutant' },
    ]).then(() => {
      cy.navTo('admin');
      cy.getByCy('tab-champions').click();
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
      cy.navTo('admin');
      cy.getByCy('tab-champions').click();
      cy.getByCy('filter-class').click();
      cy.contains('[role="menuitemradio"]', 'Tech').click();
      cy.getByCy('champion-row-Wolverine').should('not.exist');
      cy.getByCy('filter-class').click();
      cy.contains('[role="menuitemradio"]', 'All').click();
      cy.getByCy('champion-row-Iron Man').should('be.visible');
      cy.getByCy('champion-row-Wolverine').should('be.visible');
    });
  });
});
