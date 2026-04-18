import { setupWarOwner, setupAdmin } from '../../support/e2e';

describe('Season system', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows off-season badge on war page when no active season', () => {
    setupWarOwner('season-off', 'OffOwner', 'OffAlliance', 'OF').then(({ ownerData, allianceId }) => {
      cy.apiCreateWar(ownerData.access_token, allianceId, 'OffEnemy');
      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('season-off-season-badge').should('be.visible').and('contain', 'Off-season');
    });
  });

  it('shows season bans placeholder section', () => {
    setupWarOwner('season-bans', 'BansOwner', 'BansAlliance', 'BN').then(({ ownerData, allianceId }) => {
      cy.apiCreateWar(ownerData.access_token, allianceId, 'BansEnemy');
      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('season-bans-section').should('be.visible');
      cy.getByCy('season-bans-section').should('contain', 'Season bans');
      cy.getByCy('season-bans-section').should('contain', 'Coming soon');
    });
  });

  it('shows active season badge on war page when season is active', () => {
    setupAdmin('season-active-token').then(({ access_token, user_id }) => {
      cy.request({
        method: 'POST',
        url: '/api/back/admin/seasons',
        body: { number: 64 },
        headers: { Authorization: `Bearer ${access_token}` },
      }).then((res) => {
        cy.request({
          method: 'PATCH',
          url: `/api/back/admin/seasons/${res.body.id}/activate`,
          headers: { Authorization: `Bearer ${access_token}` },
        });
      });
      cy.apiLogin(user_id);
      cy.navTo('war');
      cy.getByCy('season-active-badge').should('be.visible').and('contain', 'Season 64');
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
    });
  });

  it('admin can deactivate a season', () => {
    setupAdmin('season-deact-token').then(({ access_token, user_id }) => {
      cy.request({
        method: 'POST',
        url: '/api/back/admin/seasons',
        body: { number: 55 },
        headers: { Authorization: `Bearer ${access_token}` },
      }).then((res) => {
        cy.request({
          method: 'PATCH',
          url: `/api/back/admin/seasons/${res.body.id}/activate`,
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
});
