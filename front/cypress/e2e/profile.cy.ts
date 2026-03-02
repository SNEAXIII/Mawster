/// <reference types="cypress" />

/**
 * E2E tests for the Profile page.
 * Verifies user info display, locale persistence, and sign-out.
 */
describe('Profile Page', () => {
  beforeEach(() => {
    cy.mockSession();
    cy.setLocale('en');
  });

  it('displays user profile information', () => {
    cy.visit('/profile');

    cy.contains('TestPlayer').should('be.visible');
    cy.contains('testplayer@discord.com').should('be.visible');
    cy.contains('123456789').should('be.visible'); // Discord ID
    cy.contains('user').should('be.visible'); // Role badge
  });

  it('displays account information labels', () => {
    cy.visit('/profile');

    cy.contains('Account Information').should('be.visible');
    cy.contains('Username').should('be.visible');
    cy.contains('Email').should('be.visible');
    cy.contains('Discord ID').should('be.visible');
    cy.contains('Member since').should('be.visible');
  });

  it('shows sign out button', () => {
    cy.visit('/profile');

    cy.contains('Sign out').should('be.visible');
  });

  it('navigates to profile from sidebar', () => {
    cy.visit('/');
    cy.contains('My Profile').click();
    cy.url().should('include', '/profile');
  });

  it('displays admin role badge for admin users', () => {
    cy.mockAdminSession();
    cy.visit('/profile');

    cy.contains('AdminPlayer').should('be.visible');
    cy.contains('admin').should('be.visible');
  });
});
