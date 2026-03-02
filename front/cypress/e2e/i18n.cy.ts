/// <reference types="cypress" />

/**
 * E2E tests for internationalization (i18n).
 * Verifies that the app correctly switches between English and French.
 */
describe('Internationalization (i18n)', () => {
  describe('English locale', () => {
    beforeEach(() => {
      cy.setLocale('en');
    });

    it('shows English text on landing page', () => {
      cy.visit('/');
      cy.contains('Work in Progress').should('be.visible');
      cy.contains('The application is under development').should('be.visible');
    });

    it('shows English login page', () => {
      cy.visit('/login');
      cy.contains('Sign In').should('be.visible');
      cy.contains('Sign in with Discord').should('be.visible');
    });

    it('shows English nav links when authenticated', () => {
      cy.mockSession();
      cy.visit('/');

      cy.contains('Home').should('be.visible');
      cy.contains('My Profile').should('be.visible');
      cy.contains('Game Accounts').should('be.visible');
      cy.contains('Roster').should('be.visible');
      cy.contains('Alliances').should('be.visible');
      cy.contains('Defense').should('be.visible');
    });
  });

  describe('French locale', () => {
    beforeEach(() => {
      cy.setLocale('fr');
    });

    it('shows French text on landing page', () => {
      cy.visit('/');
      cy.contains('Mawster').should('be.visible');
    });

    it('shows French login page', () => {
      cy.visit('/login');
      cy.contains('Connexion').should('be.visible');
    });
  });

  describe('Locale persistence', () => {
    it('persists locale choice in localStorage', () => {
      cy.visit('/');
      cy.setLocale('fr');
      cy.reload();

      cy.window().then((win) => {
        expect(win.localStorage.getItem('mawster-locale')).to.eq('fr');
      });
    });

    it('defaults to English when no locale is set', () => {
      cy.visit('/');
      cy.contains('Mawster').should('be.visible');
      cy.contains('Work in Progress').should('be.visible');
    });
  });
});
