import { setupAdmin, BACKEND } from '../../support/e2e';

describe('Admin — seasons panel', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('season number input only accepts digits', () => {
    setupAdmin('season-input-token').then(({ user_id }) => {
      cy.apiLogin(user_id);
      cy.navTo('admin');
      cy.getByCy('tab-seasons').click();
      cy.getByCy('season-number-input').type('abc12e-3.5').should('have.value', '1235');
    });
  });

  it('admin can create and activate a season from admin panel', () => {
    setupAdmin('season-admin-panel-token').then(({ user_id }) => {
      cy.apiLogin(user_id);
      cy.navTo('admin');
      cy.getByCy('tab-seasons').click();
      cy.getByCy('seasons-panel').should('be.visible');
      cy.getByCy('season-number-input').type('99');
      cy.getByCy('create-season-btn').click();
      cy.getByCy('season-row-99').should('be.visible');
      cy.getByCy('activate-season-99').click();
      cy.getByCy('season-active-indicator').should('be.visible');
      cy.getByCy('season-number-input').should('have.value', '');
    });
  });

  it('admin can deactivate a season', () => {
    setupAdmin('season-deact-token').then(({ access_token, user_id }) => {
      cy.request({
        method: 'POST',
        url: `${BACKEND}/admin/seasons`,
        body: { number: 55 },
        headers: { Authorization: `Bearer ${access_token}` },
      }).then((res) => {
        cy.request({
          method: 'PATCH',
          url: `${BACKEND}/admin/seasons/${res.body.id}/activate`,
          headers: { Authorization: `Bearer ${access_token}` },
        });
      });
      cy.apiLogin(user_id);
      cy.navTo('admin');
      cy.getByCy('tab-seasons').click();
      cy.getByCy('deactivate-season-55').click();
      cy.getByCy('season-inactive-indicator').should('be.visible');
    });
  });
  it('admin can deactivate a season and it will disable the previous season', () => {
    setupAdmin('season-input-token').then(({ user_id }) => {
      cy.apiLogin(user_id);
      cy.navTo('admin');
      cy.getByCy('tab-seasons').click();
      cy.getByCy('seasons-panel').should('be.visible');
      cy.getByCy('season-number-input').type('100');
      cy.getByCy('create-season-btn').click();
      cy.getByCy('season-row-100').should('be.visible').within(() => {
        cy.getByCy('season-active-indicator').should('be.visible');
      });

      cy.getByCy('season-number-input').type('101');
      cy.getByCy('create-season-btn').click();
      cy.getByCy('season-row-101').should('be.visible').within(() => {
        cy.getByCy('season-active-indicator').should('be.visible');
      });
      cy.getByCy('season-row-100').within(() => {
        cy.getByCy('season-inactive-indicator').should('be.visible');
      });
    });
  });

  it('activating a season via button deactivates the previously active season', () => {
    setupAdmin('season-swap-token').then(({ user_id }) => {
      cy.apiLogin(user_id);
      cy.navTo('admin');
      cy.getByCy('tab-seasons').click();
      cy.getByCy('seasons-panel').should('be.visible');

      cy.getByCy('season-number-input').type('200');
      cy.getByCy('create-season-btn').click();
      cy.getByCy('season-row-200').should('be.visible');

      cy.getByCy('season-number-input').type('201');
      cy.getByCy('create-season-btn').click();
      cy.getByCy('season-row-201').should('be.visible').within(() => {
        cy.getByCy('season-active-indicator').should('be.visible');
      });

      cy.getByCy('activate-season-200').click();
      cy.getByCy('season-row-200').within(() => {
        cy.getByCy('season-active-indicator').should('be.visible');
      });
      cy.getByCy('season-row-201').within(() => {
        cy.getByCy('season-inactive-indicator').should('be.visible');
      });
    });
  });
});
