import { setupWarOwner, BACKEND } from '../../support/e2e';

describe('Season — war page', () => {
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

  it('shows active season badge on war page when season is active', () => {
    setupWarOwner('season-active', 'ActiveOwner', 'ActiveAlliance', 'AC').then(({ adminData, ownerData, allianceId }) => {
      cy.request({
        method: 'POST',
        url: `${BACKEND}/admin/seasons`,
        body: { number: 64 },
        headers: { Authorization: `Bearer ${adminData.access_token}` },
      }).then((res) => {
        cy.request({
          method: 'PATCH',
          url: `${BACKEND}/admin/seasons/${res.body.id}/activate`,
          headers: { Authorization: `Bearer ${adminData.access_token}` },
        }).then(() => {
          cy.apiCreateWar(ownerData.access_token, allianceId, 'ActiveEnemy');
          cy.apiLogin(ownerData.user_id);
          cy.navTo('war');
          cy.getByCy('season-active-badge').should('be.visible').and('contain', 'Season 64');
        });
      });
    });
  });
});
