import { setupUser, setupAdmin } from '../support/e2e';

describe('Login & Profile – UI', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows the login page with Sign In title and Discord button', () => {
    cy.visit('/login');
    cy.contains('Sign In').should('be.visible');
    cy.contains('Sign in with your Discord account').should('be.visible');
    cy.contains('Sign in with Discord').should('be.visible');
  });

  it('shows registered users in the dev-mode picker', () => {
    setupUser('dev-picker-token').then(({ login }) => {
      cy.visit('/login');
      cy.contains(login).should('be.visible');
    });
  });

  it('logs in via dev-login and redirects away from /login', () => {
    setupUser('ui-login-token').then(({ login }) => {
      cy.uiLogin(login);
      cy.url().should('not.include', '/login');
    });
  });

  it('displays profile info after login', () => {
    setupUser('profile-token').then(({ login, discord_id, user_id }) => {
      cy.apiLogin(user_id);
      cy.navTo('profile');
      cy.contains('Account Information').should('be.visible');
      cy.getByCy('username-row').should('contain', login);
      cy.getByCy('discord-id-row').should('contain', discord_id);
      cy.getByCy('member-since-row').should('be.visible');
    });
  });

  it('shows admin role badge for admin users', () => {
    setupAdmin('admin-badge-token').then(({ user_id }) => {
      cy.apiLogin(user_id);
      cy.navTo('profile');
      cy.contains('admin').should('be.visible');
    });
  });

  it('signs out and redirects to login', () => {
    setupUser('signout-token').then(({ user_id }) => {
      cy.apiLogin(user_id);
      cy.navTo('profile');
      cy.getByCy('sign-out-btn').click();
      cy.url().should('include', '/login');
    });
  });

  it('redirects unauthenticated users to login', () => {
    cy.visit('/profile');
    cy.url().should('include', '/login');
  });

  // =========================================================================
  // Admin route access
  // =========================================================================

  it('admin can see and access all admin routes via navbar', () => {
    setupAdmin('admin-routes-token').then(({ user_id }) => {
      cy.apiLogin(user_id);

      // Admin nav links should be visible
      cy.getByCy('nav-administration').should('be.visible');

      // Navigate to Administration page
      cy.navTo('administration');
      cy.url().should('include', '/admin');

      // User routes should also be accessible
      cy.navTo('profile');
      cy.url().should('include', '/profile');

      cy.navTo('alliances');
      cy.url().should('include', '/game/alliances');
    });
  });

  it('non-admin user cannot see admin nav links', () => {
    setupUser('no-admin-routes-token').then(({ user_id }) => {
      cy.apiLogin(user_id);

      // User nav links should be visible
      cy.getByCy('nav-profile').should('be.visible');
      cy.getByCy('nav-alliances').should('be.visible');

      // Admin nav links should NOT be visible
      cy.getByCy('nav-administration').should('not.exist');
    });
  });

  // =========================================================================
  // Dev picker — list rendering
  // =========================================================================

  it('dev user list is scrollable and shows all users when many are registered', () => {
    // Create enough users so the list overflows max-h-60 (15rem ≈ 240px)
    Array.from({ length: 15 }, (_, i) => i).forEach((i) => {
      cy.registerUser(`account-scroll-user${i}`);
    });

    cy.visit('/login');

    cy.getByCy('dev-user-list').should('exist');
    cy.getByCy('dev-user-list').find('button').should('have.length', 15);
  });
});
