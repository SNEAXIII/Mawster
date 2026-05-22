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

  it('admin can create a season and set it as current from admin panel', () => {
    setupAdmin('season-admin-panel-token').then(({ user_id }) => {
      cy.apiLogin(user_id);
      cy.navTo('admin');
      cy.getByCy('tab-seasons').click();
      cy.getByCy('seasons-panel').should('be.visible');
      cy.getByCy('season-number-input').type('99');
      cy.getByCy('create-season-btn').click();
      cy.getByCy('season-row-99').should('be.visible');
      cy.getByCy('set-current-season-99').click();
      cy.getByCy('season-current-indicator').should('be.visible');
      cy.getByCy('season-number-input').should('have.value', '');
    });
  });

  it('admin can set off-season mode (unset current season)', () => {
    setupAdmin('season-deact-token').then(({ access_token, user_id }) => {
      cy.request({
        method: 'POST',
        url: `${BACKEND}/admin/seasons`,
        body: { number: 55 },
        headers: { Authorization: `Bearer ${access_token}` },
      }).then((res) => {
        cy.request({
          method: 'PUT',
          url: `${BACKEND}/admin/config/current-season`,
          body: { season_id: res.body.id },
          headers: { Authorization: `Bearer ${access_token}` },
        });
      });
      cy.apiLogin(user_id);
      cy.navTo('admin');
      cy.getByCy('tab-seasons').click();
      cy.getByCy('season-current-indicator').should('be.visible');
      cy.getByCy('set-off-season-btn').click();
      cy.getByCy('season-current-indicator').should('not.exist');
    });
  });

  it('setting a season as current replaces the previously current season', () => {
    setupAdmin('season-swap-token').then(({ user_id }) => {
      cy.apiLogin(user_id);
      cy.navTo('admin');
      cy.getByCy('tab-seasons').click();
      cy.getByCy('seasons-panel').should('be.visible');

      // Create two seasons — both start inactive
      cy.getByCy('season-number-input').type('200');
      cy.getByCy('create-season-btn').click();
      cy.getByCy('season-row-200').should('be.visible');

      cy.getByCy('season-number-input').type('201');
      cy.getByCy('create-season-btn').click();
      cy.getByCy('season-row-201').should('be.visible');

      // Neither season is current yet
      cy.getByCy('season-current-indicator').should('not.exist');

      // Set season 200 as current — only 200 should show the indicator
      cy.getByCy('set-current-season-200').click();
      cy.getByCy('season-row-200').within(() => {
        cy.getByCy('season-current-indicator').should('be.visible');
      });
      cy.getByCy('season-row-201').within(() => {
        cy.getByCy('season-current-indicator').should('not.exist');
      });

      // Set season 201 as current — 200 must lose the indicator
      cy.getByCy('set-current-season-201').click();
      cy.getByCy('season-row-200').within(() => {
        cy.getByCy('season-current-indicator').should('not.exist');
      });
      cy.getByCy('season-row-201').within(() => {
        cy.getByCy('season-current-indicator').should('be.visible');
      });
    });
  });
});
