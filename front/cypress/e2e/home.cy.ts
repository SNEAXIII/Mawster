import { setupUser } from '../support/e2e';

const SIGN_UP_CTAS = ['hero-cta-primary', 'cta-discord', 'cta-google'];

describe('Home', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows the landing with sign-up to signed-out visitors', () => {
    cy.visit('/');
    SIGN_UP_CTAS.forEach((cyId) => {
      cy.getByCy(cyId).should('be.visible').and('have.attr', 'href', '/login');
    });
    cy.getByCy('home-signed-in').should('not.exist');
  });

  it('replaces the landing with a placeholder for signed-in players', () => {
    setupUser('home-signed-in').then(({ user_id }) => {
      cy.apiLogin(user_id);
      cy.getByCy('home-signed-in').should('be.visible');
      cy.getByCy('home-signed-in-cta').should('have.attr', 'href', '/game/account');
      SIGN_UP_CTAS.forEach((cyId) => {
        cy.getByCy(cyId).should('not.exist');
      });
    });
  });
});
