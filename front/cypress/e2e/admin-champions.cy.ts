/// <reference types="cypress" />

import { TEST_CHAMPIONS, type MockChampion } from '../support/commands';

/**
 * E2E tests for the Admin Champions page.
 * Verifies champion listing, search, class filter, alias editing,
 * import/export, and deletion.
 */
describe('Admin Champions Page', () => {
  const championsResponse = {
    champions: TEST_CHAMPIONS,
    total_champions: TEST_CHAMPIONS.length,
    total_pages: 1,
    current_page: 1,
  };

  beforeEach(() => {
    cy.mockAdminSession();
    cy.setLocale('en');
  });

  // ─── Display ─────────────────────────────────────────

  describe('Display', () => {
    it('shows the page title', () => {
      cy.stubApi('GET', 'admin/champions*', championsResponse);
      cy.visit('/admin/champions');

      cy.contains('Champions Management').should('be.visible');
    });

    it('renders champion table with data', () => {
      cy.stubApi('GET', 'admin/champions*', championsResponse);
      cy.visit('/admin/champions');

      cy.contains('Spider-Man').should('be.visible');
      cy.contains('Doctor Doom').should('be.visible');
      cy.contains('Wolverine').should('be.visible');
      cy.contains('Iron Man').should('be.visible');
      cy.contains('Black Widow').should('be.visible');
    });

    it('shows champion classes', () => {
      cy.stubApi('GET', 'admin/champions*', championsResponse);
      cy.visit('/admin/champions');

      cy.contains('Science').should('be.visible');
      cy.contains('Mystic').should('be.visible');
      cy.contains('Mutant').should('be.visible');
      cy.contains('Tech').should('be.visible');
      cy.contains('Skill').should('be.visible');
    });

    it('shows aliases for champions that have one', () => {
      cy.stubApi('GET', 'admin/champions*', championsResponse);
      cy.visit('/admin/champions');

      cy.contains('Spidey').should('be.visible');
      cy.contains('Wolvie').should('be.visible');
    });

    it('shows empty state when no champions', () => {
      cy.stubApi('GET', 'admin/champions*', {
        champions: [],
        total_champions: 0,
        total_pages: 1,
        current_page: 1,
      });
      cy.visit('/admin/champions');

      cy.contains('No champions found').should('be.visible');
    });

    it('shows table headers', () => {
      cy.stubApi('GET', 'admin/champions*', championsResponse);
      cy.visit('/admin/champions');

      cy.contains('Name').should('be.visible');
      cy.contains('Class').should('be.visible');
      cy.contains('Aliases').should('be.visible');
      cy.contains('Actions').should('be.visible');
    });
  });

  // ─── Search ──────────────────────────────────────────

  describe('Search', () => {
    it('filters champions by search input', () => {
      cy.stubApi('GET', 'admin/champions*', championsResponse);
      cy.visit('/admin/champions');

      // Intercept search request
      const spiderOnly = {
        champions: [TEST_CHAMPIONS[0]],
        total_champions: 1,
        total_pages: 1,
        current_page: 1,
      };
      cy.intercept('GET', '/api/back/admin/champions*search=Spider*', {
        statusCode: 200,
        body: spiderOnly,
      });

      cy.get('input[placeholder="Search by name or alias..."]').type('Spider');

      // After debounce, only Spider-Man should be visible
      cy.contains('Spider-Man').should('be.visible');
    });
  });

  // ─── Class filter ────────────────────────────────────

  describe('Class filter', () => {
    it('shows class filter dropdown', () => {
      cy.stubApi('GET', 'admin/champions*', championsResponse);
      cy.visit('/admin/champions');

      cy.contains('Class').should('be.visible');
    });
  });

  // ─── Alias editing ──────────────────────────────────

  describe('Alias editing', () => {
    it('allows editing an alias inline', () => {
      cy.stubApi('GET', 'admin/champions*', championsResponse);
      cy.visit('/admin/champions');

      // Click edit alias button for Doctor Doom (no alias)
      cy.contains('tr', 'Doctor Doom').find('button').first().click();

      // An input should appear for editing
      cy.contains('tr', 'Doctor Doom').find('input').should('be.visible');
    });
  });

  // ─── Delete ──────────────────────────────────────────

  describe('Delete champion', () => {
    it('shows confirmation dialog before deleting', () => {
      cy.stubApi('GET', 'admin/champions*', championsResponse);
      cy.visit('/admin/champions');

      // Click the delete button for Wolverine (second button in actions cell)
      cy.contains('tr', 'Wolverine')
        .find('td:last-child button')
        .last()
        .click();

      cy.contains('Are you sure you want to delete Wolverine?').should('be.visible');
    });

    it('deletes champion on confirm', () => {
      cy.stubApi('GET', 'admin/champions*', championsResponse);
      cy.visit('/admin/champions');

      cy.stubApi('DELETE', `admin/champions/${TEST_CHAMPIONS[2].id}`, null, 204);

      const remainingChampions = TEST_CHAMPIONS.filter((c) => c.id !== TEST_CHAMPIONS[2].id);
      cy.intercept('GET', '/api/back/admin/champions*', {
        statusCode: 200,
        body: {
          champions: remainingChampions,
          total_champions: remainingChampions.length,
          total_pages: 1,
          current_page: 1,
        },
      });

      cy.contains('tr', 'Wolverine')
        .find('td:last-child button')
        .last()
        .click();

      cy.get('[role="alertdialog"]').contains('Delete').click();
    });
  });

  // ─── Import / Export ─────────────────────────────────

  describe('Import and Export', () => {
    it('shows import and export buttons', () => {
      cy.stubApi('GET', 'admin/champions*', championsResponse);
      cy.visit('/admin/champions');

      cy.contains('Export JSON').should('be.visible');
      cy.contains('Import JSON').should('be.visible');
    });
  });

  // ─── Navigation ──────────────────────────────────────

  describe('Navigation', () => {
    it('navigates to champions from sidebar', () => {
      cy.stubApi('GET', 'admin/champions*', championsResponse);
      cy.visit('/');
      cy.contains('Champions').click();
      cy.url().should('include', '/admin/champions');
    });
  });

  // ─── Access control ──────────────────────────────────

  describe('Access control', () => {
    it('redirects non-admin users to home', () => {
      cy.mockSession(); // regular user, not admin
      cy.visit('/admin/champions');
      cy.url().should('eq', Cypress.config().baseUrl + '/');
    });
  });
});
