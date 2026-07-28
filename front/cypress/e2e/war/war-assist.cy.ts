import { BACKEND, setupAttackerScenario } from '../../support/e2e';

const assistUrl = (allianceId: string, warId: string, nodeNumber: number) =>
  `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/node/${nodeNumber}/assist`;

function setupAssistScenario(prefix: string) {
  return setupAttackerScenario(prefix).then((scenario) => {
    return cy.apiLoadChampion(scenario.adminToken, 'Iron Man', 'Tech').then((champs: { id: string }[]) => {
      return cy
        .apiAddChampionToRoster(scenario.ownerData.access_token, scenario.ownerAccId, champs[0].id, '7r3')
        .then((cu: { id: string }) => ({ ...scenario, assistorChampionUserId: cu.id }));
    });
  });
}

describe('War Assist', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('adds assist via popover and shows assisted badge on node', () => {
    setupAssistScenario('wa1').then(({ memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.apiLogin(memberData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');

      cy.getByCy('node-actions-trigger-node-10').click();
      cy.getByCy('assist-add-node-10').click();

      cy.getByCy('assist-selector').should('be.visible');
      cy.getByCy('assist-pick-Iron-Man').click();
      cy.getByCy('assist-selector').should('not.exist');

      cy.getByCy('assisted-badge-node-10').scrollIntoView().should('be.visible');
    });
  });

  it('revokes assist via popover and badge disappears', () => {
    setupAssistScenario('wa2').then(({ memberData, allianceId, warId, championUserId, assistorChampionUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.request({
        method: 'POST',
        url: assistUrl(allianceId, warId, 10),
        headers: { Authorization: `Bearer ${memberData.access_token}` },
        body: { champion_user_id: assistorChampionUserId },
      });

      cy.apiLogin(memberData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('assisted-badge-node-10').scrollIntoView().should('be.visible');

      cy.getByCy('node-actions-trigger-node-10').click();
      cy.getByCy('assist-revoke-node-10').click();

      cy.getByCy('assisted-badge-node-10').should('not.exist');
    });
  });

  it('attacker own champion is excluded from the assist selector', () => {
    setupAssistScenario('wa3').then(({ memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.apiLogin(memberData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');

      cy.getByCy('node-actions-trigger-node-10').click();
      cy.getByCy('assist-add-node-10').click();
      cy.getByCy('assist-selector').should('be.visible');

      // Member's own champion (Wolverine) is excluded — same game account as attacker
      cy.getByCy('assist-pick-Wolverine').should('not.exist');
      // Owner's champion (Iron Man) is visible — different game account
      cy.getByCy('assist-pick-Iron-Man').should('exist');
    });
  });

  it('API — returns 422 when no attacker is assigned on the node', () => {
    setupAssistScenario('wa4').then(({ memberData, allianceId, warId, assistorChampionUserId }) => {
      cy.request({
        method: 'POST',
        url: assistUrl(allianceId, warId, 10),
        headers: { Authorization: `Bearer ${memberData.access_token}` },
        body: { champion_user_id: assistorChampionUserId },
        failOnStatusCode: false,
      }).then((res) => expect(res.status).to.eq(422));
    });
  });

  it('API — returns 409 when assistor is the same game account as the attacker', () => {
    setupAssistScenario('wa5').then(({ memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.request({
        method: 'POST',
        url: assistUrl(allianceId, warId, 10),
        headers: { Authorization: `Bearer ${memberData.access_token}` },
        body: { champion_user_id: championUserId },
        failOnStatusCode: false,
      }).then((res) => expect(res.status).to.eq(409));
    });
  });
});
