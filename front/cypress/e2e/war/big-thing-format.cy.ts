import { setupWarOwner, BACKEND } from '../../support/e2e';

describe('Big Thing season format — war page', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('renders a 10-node map and a Big Thing badge under an active big_thing season', () => {
    setupWarOwner('bigthing', 'BTOwner', 'BTAlliance', 'BT').then(
      ({ adminData, ownerData, allianceId }) => {
        cy.request({
          method: 'POST',
          url: `${BACKEND}/admin/seasons`,
          body: { number: 70, format: 'big_thing' },
          headers: { Authorization: `Bearer ${adminData.access_token}` },
        }).then((res) => {
          cy.request({
            method: 'PATCH',
            url: `${BACKEND}/admin/seasons/${res.body.id}/open`,
            headers: { Authorization: `Bearer ${adminData.access_token}` },
          }).then(() => {
            cy.apiCreateWar(ownerData.access_token, allianceId, 'BTEnemy');
            cy.apiLogin(ownerData.user_id);
            cy.navTo('war');

            // Big Thing format badge is shown
            cy.getByCy('season-format-banner').should('be.visible').and('contain', 'Big Thing');

            // Big Thing map has exactly 10 nodes (1..10); node 11+ from the
            // regular 50-node layout must not be rendered.
            cy.getByCy('war-node-10').should('exist');
            cy.getByCy('war-node-1').should('exist');
            cy.getByCy('war-node-11').should('not.exist');
            cy.getByCy('war-node-50').should('not.exist');
          });
        });
      },
    );
  });
});
