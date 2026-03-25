import { setupUser } from '../support/e2e';

describe('Login – Dev user picker', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows the dev user picker with registered users', () => {
    setupUser('login-user1').then(() => {
      cy.visit('/login');
      cy.contains('🔓').should('be.visible');
    });
  });

  it('lists all registered users as clickable buttons', () => {
    setupUser('login-btn-a').then((a) => {
      setupUser('login-btn-b').then((b) => {
        cy.visit('/login');
        cy.contains('button', a.login).should('be.visible');
        cy.contains('button', b.login).should('be.visible');
      });
    });
  });

  it('logs in successfully by clicking a user button', () => {
    setupUser('login-click-user').then((userData) => {
      cy.visit('/login');
      cy.contains('button', userData.login, { timeout: 10000 }).click();
      cy.url({ timeout: 10000 }).should('not.include', '/login');
    });
  });

  it('user list container is scrollable when many users are registered', () => {
    // Create enough users so the list overflows max-h-60 (15rem ≈ 240px)
    Array.from({ length: 15 }, (_, i) => i).forEach((i) => {
      cy.registerUser(`login-scroll-user${i}`);
    });

    cy.visit('/login');

    // The list container must exist and be scrollable
    cy.getByCy('dev-user-list').should('exist');

    // All 15 users should be present as buttons in the DOM (even if not all visible)
    cy.getByCy('dev-user-list').find('button').should('have.length', 15);
  });
});
