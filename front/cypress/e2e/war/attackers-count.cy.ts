import { setupAttackerScenario } from '../../support/e2e';

describe('War – attackers count badge color', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('count badge is red when fewer than 50 attackers are assigned', () => {
    setupAttackerScenario('war-cnt-red').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');

      cy.getByCy('attackers-count').should('have.class', 'text-red-400');
      cy.getByCy('attackers-count').should('not.have.class', 'text-yellow-400');
    });
  });

  it('count badge is gold when all 50 attackers are assigned', () => {
    setupAttackerScenario('war-cnt-gold').then(({ ownerData, ownerAccId, warId }) => {
      cy.apiBulkFillWarAttackers(warId, 1, ownerAccId, 50);

      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');

      cy.getByCy('attackers-count').should('have.class', 'text-yellow-400');
      cy.getByCy('attackers-count').should('not.have.class', 'text-red-400');
    });
  });
});
