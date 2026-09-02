import { setupWarOwner } from '../../support/e2e';

describe('Season — war page', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows pre-season badge on war page when no active season', () => {
    setupWarOwner('season-off', 'OffOwner', 'OffAlliance', 'OF').then(({ ownerData, allianceId }) => {
      cy.apiCreateWar(ownerData.access_token, allianceId, 'OffEnemy');
      cy.apiLogin(ownerData.user_id, 'war');
      cy.getByCy('season-pre-season-badge').should('be.visible').and('contain', 'Pre-season');
    });
  });

  it('shows active season badge on war page when season is active', () => {
    setupWarOwner('season-active', 'ActiveOwner', 'ActiveAlliance', 'AC').then(
      ({ adminData, ownerData, allianceId }) => {
        cy.apiCreateOpenSeason(adminData.access_token, 64).then(() => {
          cy.apiCreateWar(ownerData.access_token, allianceId, 'ActiveEnemy');
          cy.apiLogin(ownerData.user_id, 'war');
          cy.getByCy('season-active-badge').should('be.visible').and('contain', 'Season 64');
        });
      },
    );
  });
});
