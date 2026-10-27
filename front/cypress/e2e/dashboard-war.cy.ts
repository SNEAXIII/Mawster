import { setupAssignedAttacker } from '../support/e2e';

describe('Player Dashboard – war block', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('warns about a non-Ready Battlegroup and keeps a KO across a refresh', () => {
    setupAssignedAttacker('dash-war').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id);

      cy.getByCy('dashboard-war-not-ready').should('be.visible');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.intercept('PATCH', '**/node/10/ko').as('updateKo');
      cy.getByCy('ko-inc-node-10').click();
      cy.getByCy('ko-value-node-10').should('have.text', '1');
      cy.wait('@updateKo');

      cy.getByCy('dashboard-refresh').click();
      cy.getByCy('dashboard-refresh').should('be.disabled');
      cy.getByCy('ko-value-node-10').should('have.text', '1');
    });
  });
});
