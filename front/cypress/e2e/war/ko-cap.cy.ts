import { BACKEND, setupAssignedAttacker } from '../../support/e2e';

/** A defender is exhausted after 3 attacker KOs, so nothing may record more. */
const MAX_KO = 3;

describe('War – KO cap', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── The increment button ──────────────────────────────────────────────────

  it('stops incrementing once the node reaches three KOs', () => {
    setupAssignedAttacker('ko-cap-inc').then(({ ownerData }) => {
      cy.openWarAttackerPanel(ownerData.user_id);

      for (let i = 0; i < MAX_KO; i += 1) {
        cy.getByCy('ko-inc-node-10').click();
      }

      cy.getByCy('ko-value-node-10').should('have.text', String(MAX_KO));
      cy.getByCy('ko-inc-node-10').should('be.disabled');
    });
  });

  it('re-enables the increment once a KO is taken back', () => {
    setupAssignedAttacker('ko-cap-dec').then(({ ownerData, allianceId, warId }) => {
      cy.apiUpdateWarKo(ownerData.access_token, allianceId, warId, 1, 10, MAX_KO);
      cy.openWarAttackerPanel(ownerData.user_id);

      cy.getByCy('ko-inc-node-10').should('be.disabled');
      cy.getByCy('ko-dec-node-10').click();

      cy.getByCy('ko-value-node-10').should('have.text', '2');
      cy.getByCy('ko-inc-node-10').should('not.be.disabled');
    });
  });

  it('keeps the decrement disabled at zero', () => {
    setupAssignedAttacker('ko-cap-zero').then(({ ownerData }) => {
      cy.openWarAttackerPanel(ownerData.user_id);

      cy.getByCy('ko-value-node-10').should('have.text', '0');
      cy.getByCy('ko-dec-node-10').should('be.disabled');
    });
  });

  // ── The API behind it ─────────────────────────────────────────────────────

  it('refuses a KO count above three', () => {
    setupAssignedAttacker('ko-cap-api').then(({ ownerData, allianceId, warId }) => {
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
