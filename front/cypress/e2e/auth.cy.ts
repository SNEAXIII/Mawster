/// <reference types="cypress" />

/**
 * E2E tests for authentication and navigation flows.
 * Verifies public/protected routing, login page, and session management.
 */
describe('Authentication & Navigation', () => {
  // ─── Public pages ────────────────────────────────────

  describe('Public pages', () => {
    it('displays the landing page without authentication', () => {
      cy.visit('/');
      cy.contains('Mawster').should('be.visible');
      cy.contains('Work in Progress').should('be.visible');
    });

    it('displays the login page with Discord button', () => {
      cy.visit('/login');
      cy.contains('Sign In').should('be.visible');
      cy.contains('Sign in with Discord').should('be.visible');
    });

    it('displays the register page with Discord button', () => {
      cy.visit('/register');
      cy.contains('Create an account').should('be.visible');
      cy.contains('Sign up with Discord').should('be.visible');
    });
  });

  // ─── Protected routes — unauthenticated ──────────────

  describe('Protected routes — unauthenticated', () => {
    it('redirects /profile to /login', () => {
      cy.visit('/profile');
      cy.url().should('include', '/login');
    });

    it('redirects /game/accounts to /login', () => {
      cy.visit('/game/accounts');
      cy.url().should('include', '/login');
    });

    it('redirects /game/roster to /login', () => {
      cy.visit('/game/roster');
      cy.url().should('include', '/login');
    });

    it('redirects /game/alliances to /login', () => {
      cy.visit('/game/alliances');
      cy.url().should('include', '/login');
    });

    it('redirects /game/defense to /login', () => {
      cy.visit('/game/defense');
      cy.url().should('include', '/login');
    });

    it('redirects /admin/dashboard to /login', () => {
      cy.visit('/admin/dashboard');
      cy.url().should('include', '/login');
    });

    it('redirects /admin/champions to /login', () => {
      cy.visit('/admin/champions');
      cy.url().should('include', '/login');
    });
  });

  // ─── Authenticated navigation ────────────────────────

  describe('Authenticated navigation', () => {
    beforeEach(() => {
      cy.mockSession();
      cy.setLocale('en');
    });

    it('redirects authenticated user away from /login to /', () => {
      cy.visit('/login');
      cy.url().should('eq', Cypress.config().baseUrl + '/');
    });

    it('redirects authenticated user away from /register to /', () => {
      cy.visit('/register');
      cy.url().should('eq', Cypress.config().baseUrl + '/');
    });

    it('shows navigation links for authenticated user', () => {
      cy.visit('/');
      cy.contains('Home').should('be.visible');
      cy.contains('My Profile').should('be.visible');
      cy.contains('Game Accounts').should('be.visible');
      cy.contains('Roster').should('be.visible');
      cy.contains('Alliances').should('be.visible');
      cy.contains('Defense').should('be.visible');
    });

    it('does not show admin links for regular user', () => {
      cy.visit('/');
      cy.contains('Administration').should('not.exist');
      cy.contains('Champions').should('not.exist');
    });

    it('redirects non-admin from /admin/dashboard to /', () => {
      cy.visit('/admin/dashboard');
      cy.url().should('eq', Cypress.config().baseUrl + '/');
    });
  });

  // ─── Admin navigation ────────────────────────────────

  describe('Admin navigation', () => {
    beforeEach(() => {
      cy.mockAdminSession();
      cy.setLocale('en');
    });

    it('shows admin links for admin user', () => {
      cy.visit('/');
      cy.contains('Administration').should('be.visible');
      cy.contains('Champions').should('be.visible');
    });

    it('allows admin to access /admin/dashboard', () => {
      cy.stubApi('GET', 'admin/users*', {
        users: [],
        total_users: 0,
        total_pages: 1,
        current_page: 1,
      });

      cy.visit('/admin/dashboard');
      cy.url().should('include', '/admin/dashboard');
    });

    it('allows admin to access /admin/champions', () => {
      cy.stubApi('GET', 'admin/champions*', {
        champions: [],
        total_champions: 0,
        total_pages: 1,
        current_page: 1,
      });

      cy.visit('/admin/champions');
      cy.url().should('include', '/admin/champions');
    });
  });
});
