import { setupUser } from '../support/e2e';

const SIGN_UP_CTAS = ['hero-cta-primary', 'cta-discord', 'cta-google'];

describe('Home – calls to action', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('offers sign-up to signed-out visitors', () => {
    cy.visit('/');
    SIGN_UP_CTAS.forEach((cyId) => {
      cy.getByCy(cyId).should('be.visible').and('have.attr', 'href', '/login');
    });
    cy.getByCy('hero-cta-app').should('not.exist');
  });

  it('links signed-in players to their roster instead of sign-up', () => {
    setupUser('home-signed-in').then(({ user_id }) => {
      cy.apiLogin(user_id);
      cy.getByCy('hero-cta-app').should('be.visible').and('have.attr', 'href', '/game/account');
      SIGN_UP_CTAS.forEach((cyId) => {
        cy.getByCy(cyId).should('not.exist');
      });
    });
  });
});
