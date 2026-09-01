import { setupAdmin, confirmAction } from '../../support/e2e';

describe('Admin — seasons panel', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('season number input only accepts digits', () => {
    setupAdmin('season-input-token').then(({ user_id }) => {
      cy.apiLogin(user_id, 'admin');
      cy.getByCy('tab-seasons').click();
      cy.getByCy('season-number-input').type('abc12e-3.5').should('have.value', '1235');
    });
  });

  it('admin can create and open a season from the panel', () => {
    setupAdmin('season-admin-panel-token').then(({ user_id }) => {
      cy.apiLogin(user_id, 'admin');
      cy.getByCy('tab-seasons').click();
      cy.getByCy('seasons-panel').should('be.visible');
      cy.getByCy('season-number-input').type('99');
      cy.getByCy('create-season-btn').click();
      cy.getByCy('season-row-99').should('be.visible');
      // Newly created season is pre-season (upcoming)
      cy.getByCy('season-row-99').within(() => {
        cy.getByCy('season-status-upcoming').should('be.visible');
      });
      // Open it (confirmation dialog)
      confirmAction('open-season-99');
      cy.getByCy('season-row-99').within(() => {
        cy.getByCy('season-status-active').should('be.visible');
      });
      cy.getByCy('season-number-input').should('have.value', '');
    });
  });

  it('admin can close a season then reopen it (recover a mistaken close)', () => {
    setupAdmin('season-close-token').then(({ access_token, user_id }) => {
      cy.apiRequest(access_token, 'POST', '/admin/seasons', { number: 55 });
      cy.apiLogin(user_id, 'admin');
      cy.getByCy('tab-seasons').click();

      // Open
      confirmAction('open-season-55');
      cy.getByCy('season-row-55').within(() => {
        cy.getByCy('season-status-active').should('be.visible');
      });

      // Close
      confirmAction('close-season-55');
      cy.getByCy('season-row-55').within(() => {
        cy.getByCy('season-status-ended').should('be.visible');
      });

      // Reopen via the same Open action
      confirmAction('open-season-55');
      cy.getByCy('season-row-55').within(() => {
        cy.getByCy('season-status-active').should('be.visible');
      });
    });
  });

  it('admin can revert a closed season back to pre-season (recover a mistaken close)', () => {
    setupAdmin('season-revert-token').then(({ access_token, user_id }) => {
      cy.apiRequest(access_token, 'POST', '/admin/seasons', { number: 56 });
      cy.apiLogin(user_id, 'admin');
      cy.getByCy('tab-seasons').click();

      // Open then close to reach the ended state
      confirmAction('open-season-56');
      confirmAction('close-season-56');
      cy.getByCy('season-row-56').within(() => {
        cy.getByCy('season-status-ended').should('be.visible');
      });

      // Revert back to pre-season
      confirmAction('revert-season-56');
      cy.getByCy('season-row-56').within(() => {
        cy.getByCy('season-status-upcoming').should('be.visible');
      });
    });
  });
});
