/// <reference types="cypress" />

/**
 * E2E tests for the Admin Dashboard page.
 * Verifies user listing, search, pagination, and admin actions.
 */
describe('Admin Dashboard Page', () => {
  const usersResponse = {
    users: [
      {
        login: 'TestPlayer',
        email: 'test@discord.com',
        role: 'user',
        id: 'user-001',
        created_at: '2024-01-15T10:30:00Z',
        last_login_date: '2024-04-01T08:00:00Z',
        disabled_at: null,
        deleted_at: null,
      },
      {
        login: 'AdminPlayer',
        email: 'admin@discord.com',
        role: 'admin',
        id: 'admin-001',
        created_at: '2024-01-01T08:00:00Z',
        last_login_date: '2024-04-02T12:00:00Z',
        disabled_at: null,
        deleted_at: null,
      },
      {
        login: 'DisabledUser',
        email: 'disabled@discord.com',
        role: 'user',
        id: 'user-002',
        created_at: '2024-02-01T10:00:00Z',
        last_login_date: null,
        disabled_at: '2024-03-01T10:00:00Z',
        deleted_at: null,
      },
    ],
    total_users: 3,
    total_pages: 1,
    current_page: 1,
  };

  beforeEach(() => {
    cy.mockAdminSession();
    cy.setLocale('en');
  });

  // ─── Display ─────────────────────────────────────────

  describe('Display', () => {
    it('shows user table with data', () => {
      cy.stubApi('GET', 'admin/users*', usersResponse);
      cy.visit('/admin/dashboard');

      cy.contains('TestPlayer').should('be.visible');
      cy.contains('AdminPlayer').should('be.visible');
      cy.contains('DisabledUser').should('be.visible');
    });

    it('shows table headers', () => {
      cy.stubApi('GET', 'admin/users*', usersResponse);
      cy.visit('/admin/dashboard');

      cy.contains('Login').should('be.visible');
      cy.contains('Email').should('be.visible');
      cy.contains('Role').should('be.visible');
      cy.contains('Status').should('be.visible');
    });

    it('shows user emails', () => {
      cy.stubApi('GET', 'admin/users*', usersResponse);
      cy.visit('/admin/dashboard');

      cy.contains('test@discord.com').should('be.visible');
      cy.contains('admin@discord.com').should('be.visible');
    });
  });

  // ─── Search ──────────────────────────────────────────

  describe('Search', () => {
    it('has a search input', () => {
      cy.stubApi('GET', 'admin/users*', usersResponse);
      cy.visit('/admin/dashboard');

      cy.get('input[placeholder="Search by login or email..."]').should('be.visible');
    });

    it('filters users by search', () => {
      cy.stubApi('GET', 'admin/users*', usersResponse);
      cy.visit('/admin/dashboard');

      const filteredResponse = {
        users: [usersResponse.users[0]],
        total_users: 1,
        total_pages: 1,
        current_page: 1,
      };

      cy.intercept('GET', '/api/back/admin/users*search=Test*', {
        statusCode: 200,
        body: filteredResponse,
      });

      cy.get('input[placeholder="Search by login or email..."]').type('Test');

      // After debounce, filtered results should show
      cy.contains('TestPlayer').should('be.visible');
    });
  });

  // ─── Admin actions ──────────────────────────────────

  describe('Admin actions', () => {
    it('shows action buttons for users', () => {
      cy.stubApi('GET', 'admin/users*', usersResponse);
      cy.visit('/admin/dashboard');

      // Should have action buttons in the table
      cy.get('table').find('button').should('have.length.at.least', 1);
    });

    it('shows disable confirmation dialog', () => {
      cy.stubApi('GET', 'admin/users*', usersResponse);
      cy.visit('/admin/dashboard');

      // Open the actions dropdown for TestPlayer
      cy.contains('tr', 'TestPlayer')
        .find('button')
        .first()
        .click();

      // Click "Disable" in the dropdown menu
      cy.contains('[role="menuitem"]', 'Disable').click();

      // Should show a confirmation dialog
      cy.get('[role="alertdialog"]').should('be.visible');
    });
  });

  // ─── Pagination ──────────────────────────────────────

  describe('Pagination', () => {
    it('shows pagination when multiple pages exist', () => {
      const paginatedResponse = {
        ...usersResponse,
        total_users: 50,
        total_pages: 5,
        current_page: 1,
      };

      cy.stubApi('GET', 'admin/users*', paginatedResponse);
      cy.visit('/admin/dashboard');

      cy.contains('Page').should('be.visible');
    });
  });

  // ─── Access control ──────────────────────────────────

  describe('Access control', () => {
    it('redirects non-admin users to home', () => {
      cy.mockSession(); // regular user
      cy.visit('/admin/dashboard');
      cy.url().should('eq', Cypress.config().baseUrl + '/');
    });
  });

  // ─── Navigation ──────────────────────────────────────

  describe('Navigation', () => {
    it('navigates to admin dashboard from sidebar', () => {
      cy.stubApi('GET', 'admin/users*', usersResponse);
      cy.visit('/');
      cy.contains('Administration').click();
      cy.url().should('include', '/admin/dashboard');
    });
  });
});
