import { setupWarOwner, BACKEND } from '../../support/e2e';

describe('Big Thing war — war page', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('renders Big Thing map when off-season Big Thing is active', () => {
    setupWarOwner('bt-war-off', 'BtOwner', 'BtAlliance', 'BT').then(
      ({ adminData, ownerData, allianceId }) => {
        cy.request({
          method: 'PUT',
          url: `${BACKEND}/admin/config/off-season-big-thing`,
          body: { enabled: true },
          headers: { Authorization: `Bearer ${adminData.access_token}` },
        }).then(() => {
          cy.apiCreateWar(ownerData.access_token, allianceId, 'BtEnemy');
          cy.apiLogin(ownerData.user_id);
          cy.navTo('war');
          cy.getByCy('big-thing-war-map').should('be.visible');
        });
      },
    );
  });

  it('renders Big Thing map for a Big Thing season war', () => {
    setupWarOwner('bt-war-season', 'BtSOwner', 'BtSAlliance', 'BS').then(
      ({ adminData, ownerData, allianceId }) => {
        cy.request({
          method: 'POST',
          url: `${BACKEND}/admin/seasons`,
          body: { number: 99, is_big_thing: true },
          headers: { Authorization: `Bearer ${adminData.access_token}` },
        }).then((seasonRes) => {
          cy.request({
            method: 'PUT',
            url: `${BACKEND}/admin/config/current-season`,
            body: { season_id: seasonRes.body.id },
            headers: { Authorization: `Bearer ${adminData.access_token}` },
          }).then(() => {
            cy.apiCreateWar(ownerData.access_token, allianceId, 'BtSEnemy');
            cy.apiLogin(ownerData.user_id);
            cy.navTo('war');
            cy.getByCy('big-thing-war-map').should('be.visible');
          });
        });
      },
    );
  });
});
