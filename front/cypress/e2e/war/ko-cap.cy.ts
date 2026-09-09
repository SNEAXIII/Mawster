import { BACKEND, openWarNode, setupAttackerScenario } from '../../support/e2e';

/** A defender is exhausted after 3 attacker KOs, so nothing may record more. */
const MAX_KO = 3;

describe('War – KO cap', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── The increment button ──────────────────────────────────────────────────

  it('stops incrementing once the node reaches three KOs', () => {
    setupAttackerScenario('ko-cap-inc').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.goToWarMode(ownerData.user_id, 'attackers');
      openWarNode(10);

      for (let i = 0; i < MAX_KO; i += 1) {
        cy.getByCy('ko-inc-node-10').click();
      }

      cy.getByCy('ko-value-node-10').should('have.text', String(MAX_KO));
      cy.getByCy('ko-inc-node-10').should('be.disabled');
    });
  });

  it('re-enables the increment once a KO is taken back', () => {
    setupAttackerScenario('ko-cap-dec').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiUpdateWarKo(ownerData.access_token, allianceId, warId, 1, 10, MAX_KO);
      cy.goToWarMode(ownerData.user_id, 'attackers');
      openWarNode(10);

      cy.getByCy('ko-inc-node-10').should('be.disabled');
      cy.getByCy('ko-dec-node-10').click();

      cy.getByCy('ko-value-node-10').should('have.text', '2');
      cy.getByCy('ko-inc-node-10').should('not.be.disabled');
    });
  });

  it('keeps the decrement disabled at zero', () => {
    setupAttackerScenario('ko-cap-zero').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.goToWarMode(ownerData.user_id, 'attackers');
      openWarNode(10);

      cy.getByCy('ko-value-node-10').should('have.text', '0');
      cy.getByCy('ko-dec-node-10').should('be.disabled');
    });
  });

  // ── The API behind it ─────────────────────────────────────────────────────

  it('refuses a KO count above three', () => {
    setupAttackerScenario('ko-cap-api').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.request({
        method: 'PATCH',
        url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/node/10/ko`,
        headers: { Authorization: `Bearer ${ownerData.access_token}` },
        body: { ko_count: MAX_KO + 1 },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(422);
      });
    });
  });
});
