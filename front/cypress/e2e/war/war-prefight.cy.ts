import { BACKEND, setupAttackerScenario, setupPrefightScenario } from '../../support/e2e';

describe('War Prefight', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('adds a pre-fight champion via the popover and shows the badge', () => {
    setupPrefightScenario('pf1').then(
      ({ memberData, allianceId, warId, championUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        cy.apiLogin(memberData.user_id);
        cy.visit('/game/war');
        cy.getByCy('war-attacker-panel').should('be.visible');

        cy.getByCy('prefight-trigger-node-10').click();
        cy.getByCy('prefight-add-node-10').click();

        cy.getByCy('prefight-selector').should('be.visible');
        cy.getByCy('prefight-pick-Storm').click();

        cy.getByCy('prefight-trigger-node-10').find('[title]').should('exist');
      }
    );
  });

  it('revokes a pre-fight champion via the popover', () => {
    setupPrefightScenario('pf2').then(
      ({ memberData, allianceId, warId, championUserId, prefightChampionUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiAddWarPrefight(memberData.access_token, allianceId, warId, 1, prefightChampionUserId, 10);

        cy.apiLogin(memberData.user_id);
        cy.visit('/game/war');
        cy.getByCy('war-attacker-panel').should('be.visible');

        cy.getByCy('prefight-trigger-node-10').click();
        cy.getByCy('prefight-revoke-Storm').click();

        cy.getByCy('prefight-trigger-node-10').find('[title]').should('not.exist');
      }
    );
  });

  it('returns 422 when no attacker is assigned on the node', () => {
    setupAttackerScenario('pf3').then(
      ({ adminToken, memberData, memberAccId, allianceId, warId }) => {
        const prefightUrl = `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/prefight`;

        cy.apiLoadChampion(adminToken, 'Storm', 'Mutant').then((champs) => {
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3').then((stormCu) => {
            cy.request({
              method: 'POST',
              url: prefightUrl,
              headers: { Authorization: `Bearer ${memberData.access_token}` },
              body: { champion_user_id: stormCu.id, target_node_number: 10 },
              failOnStatusCode: false,
            }).then((res) => {
              expect(res.status).to.eq(422);
            });
          });
        });
      }
    );
  });

  it('returns 409 on duplicate pre-fight assignment', () => {
    setupPrefightScenario('pf4').then(
      ({ memberData, allianceId, warId, championUserId, prefightChampionUserId }) => {
        const prefightUrl = `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/prefight`;
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        const payload = { champion_user_id: prefightChampionUserId, target_node_number: 10 };

        cy.request({
          method: 'POST',
          url: prefightUrl,
          headers: { Authorization: `Bearer ${memberData.access_token}` },
          body: payload,
        }).then((res) => expect(res.status).to.eq(201));

        cy.request({
          method: 'POST',
          url: prefightUrl,
          headers: { Authorization: `Bearer ${memberData.access_token}` },
          body: payload,
          failOnStatusCode: false,
        }).then((res) => expect(res.status).to.eq(409));
      }
    );
  });
});
