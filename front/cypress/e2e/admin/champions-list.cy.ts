import { setupAdmin } from '../../support/e2e';

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
      cy.getByCy('champions-filter-trigger').click();
      cy.getByCy('champions-filter-has_prefight').contains('button', 'Yes').click();
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
      cy.getByCy('champions-filter-trigger').click();
      cy.getByCy('champions-filter-is_ascendable').contains('button', 'Yes').click();
      cy.getByCy('champion-row-Iron Man').should('be.visible');
      cy.getByCy('champion-row-Wolverine').should('not.exist');
    });
  });

  it('filter by is_7_stars_available=No shows only champions without 7 stars', () => {
    cy.apiLoadChampions(adminToken, [
      { name: 'Iron Man', cls: 'Tech', is_7_stars_available: true },
      { name: 'Wolverine', cls: 'Mutant', is_7_stars_available: false },
    ]).then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('champions-filter-trigger').click();
      cy.getByCy('champions-filter-is_7_stars_available').contains('button', 'No').click();
      cy.getByCy('champion-row-Wolverine').should('be.visible');
      cy.getByCy('champion-row-Iron Man').should('not.exist');
    });
  });

  it('filter by saga attacker=Yes shows only the season’s attackers', () => {
    cy.apiCreateSeason(adminToken, 40);
    cy.apiLoadChampions(adminToken, [
      { name: 'Iron Man', cls: 'Tech' },
      { name: 'Wolverine', cls: 'Mutant' },
    ]).then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('champion-attr-saga-attacker-Iron Man').click();
      cy.getByCy('champion-attr-saga-attacker-Iron Man').should('have.attr', 'aria-pressed', 'true');

      cy.getByCy('champions-filter-trigger').click();
      cy.getByCy('champions-filter-is_saga_attacker').contains('button', 'Yes').click();
      cy.getByCy('champion-row-Iron Man').should('be.visible');
      cy.getByCy('champion-row-Wolverine').should('not.exist');
    });
  });

  it('filter by saga attacker=No keeps champions that have no saga role at all', () => {
    // The listing outer-joins the saga table: a champion with no role row for the
    // season must still come back as "not an attacker". An inner join would drop
    // Wolverine here, and the filter would silently hide most of the catalogue.
    cy.apiCreateSeason(adminToken, 41);
    cy.apiLoadChampions(adminToken, [
      { name: 'Iron Man', cls: 'Tech' },
      { name: 'Wolverine', cls: 'Mutant' },
    ]).then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('champion-attr-saga-attacker-Iron Man').click();
      cy.getByCy('champion-attr-saga-attacker-Iron Man').should('have.attr', 'aria-pressed', 'true');

      cy.getByCy('champions-filter-trigger').click();
      cy.getByCy('champions-filter-is_saga_attacker').contains('button', 'No').click();
      cy.getByCy('champion-row-Wolverine').should('be.visible');
      cy.getByCy('champion-row-Iron Man').should('not.exist');
    });
  });

  it('sorting by name reverses the order on a second click', () => {
    cy.apiLoadChampions(adminToken, [
      { name: 'Iron Man', cls: 'Tech' },
      { name: 'Wolverine', cls: 'Mutant' },
    ]).then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('champions-list').find('tbody tr').first().should('contain.text', 'Iron Man');

      // The list is refetched behind a 300ms debounce and the old rows stay on
      // screen meanwhile, so wait for the sorted response before asserting.
      cy.intercept('GET', '**/champions?*order_dir=desc*').as('sortedDesc');
      cy.getByCy('champions-sort-name').click();
      cy.wait('@sortedDesc');
      cy.getByCy('champions-list').find('tbody tr').first().should('contain.text', 'Wolverine');
    });
  });

  it('sorting by class groups champions by class', () => {
    cy.apiLoadChampions(adminToken, [
      { name: 'Wolverine', cls: 'Mutant' },
      { name: 'Iron Man', cls: 'Tech' },
      { name: 'Colossus', cls: 'Mutant' },
    ]).then(() => {
      cy.goToAdminChampionsTab();
      cy.intercept('GET', '**/champions?*order_by=champion_class*').as('sortedByClass');
      cy.getByCy('champions-sort-champion_class').click();
      cy.wait('@sortedByClass');
      // Mutant before Tech, and name breaks the tie inside a class.
      cy.getByCy('champions-list')
        .find('tbody tr')
        .then(($rows) => {
          const names = [...$rows].map((row) => row.textContent ?? '');
          expect(names[0]).to.contain('Colossus');
          expect(names[1]).to.contain('Wolverine');
          expect(names[2]).to.contain('Iron Man');
        });
    });
  });

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
      // Wait for the Radix menu to fully close before reopening — reopening
      // mid-exit-animation swallows the toggle and the content never remounts.
      cy.get('[role="menu"]').should('not.exist');
      cy.getByCy('filter-class').click();
      cy.get('[role="menu"]').should('be.visible');
      cy.contains('[role="menuitemradio"]', 'All').click();
      cy.getByCy('champion-row-Iron Man').should('be.visible');
      cy.getByCy('champion-row-Wolverine').should('be.visible');
    });
  });
});
