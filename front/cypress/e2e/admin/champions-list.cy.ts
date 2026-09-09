import { setupAdmin } from '../../support/e2e';

const ROW_SELECTOR = '[data-cy^="champion-row-"]';

/** Re-queried on each retry, unlike a subject captured through getByCy. */
const firstRow = () => cy.get(ROW_SELECTOR).first();

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
      // cy.get is a query, so it is re-run on every retry. Going through the
      // getByCy command instead would pin the subject to the pre-sort rows and
      // the assertion would keep re-checking a detached <tr>.
      firstRow().should('have.attr', 'data-cy', 'champion-row-Iron Man');

      cy.getByCy('champions-sort-name').click();
      firstRow().should('have.attr', 'data-cy', 'champion-row-Wolverine');
    });
  });

  it('sorting by class groups champions by class', () => {
    cy.apiLoadChampions(adminToken, [
      { name: 'Wolverine', cls: 'Mutant' },
      { name: 'Iron Man', cls: 'Tech' },
      { name: 'Colossus', cls: 'Mutant' },
    ]).then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('champions-sort-champion_class').click();
      // Mutant before Tech, and name breaks the tie inside a class. Asserted
      // through should(callback), which retries; .then() runs once, and here it
      // ran before the sorted list arrived — on rows still ordered by name,
      // where Colossus happens to come first as well.
      cy.get(ROW_SELECTOR).should(($rows) => {
        const order = [...$rows].map((row) => row.getAttribute('data-cy'));
        expect(order).to.deep.equal(['champion-row-Colossus', 'champion-row-Wolverine', 'champion-row-Iron Man']);
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
