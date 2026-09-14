import { setupAdmin } from '../../support/e2e';

const IMPORTED = [
  { name: 'Imported Hero', champion_class: 'Cosmic', alias: 'IH', has_prefight: true },
  { name: 'Second Import', champion_class: 'Mystic' },
];

describe('Admin — champion JSON import and export', () => {
  beforeEach(() => {
    cy.truncateDb();
    setupAdmin('champ-io-admin').then(({ user_id }) => {
      cy.apiLogin(user_id);
      cy.goToAdminChampionsTab();
    });
  });

  it('importing a JSON file lists the new champions without a reload', () => {
    cy.get('[data-cy="champion-row-Imported Hero"]').should('not.exist');

    cy.getByCy('import-champions-input').selectFile(
      { contents: Cypress.Buffer.from(JSON.stringify(IMPORTED)), fileName: 'champions.json' },
      { force: true },
    );

    cy.get('[data-cy="champion-row-Imported Hero"]').should('contain.text', 'IH');
    cy.get('[data-cy="champion-row-Second Import"]').should('exist');
  });

  it('export requests the full catalog from the API', () => {
    // The export reuses the list endpoint with the whole catalog in one page.
    cy.intercept({ method: 'GET', pathname: '**/champions', query: { size: '9999' } }).as('exportChampions');
    cy.getByCy('export-champions-btn').click();
    cy.wait('@exportChampions').its('response.statusCode').should('eq', 200);
  });
});
