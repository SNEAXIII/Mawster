import { setupAttackerScenario } from '../../support/e2e';

describe('War – Fight Not Done & Planning Error', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Mutual exclusion ─────────────────────────────────────────────────────

  it('fight-not-done button is visually disabled when planning-error is active', () => {
    setupAttackerScenario('fnd-disabled-by-pe').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiTogglePlanningError(ownerData.access_token, allianceId, warId, 1, 10);
      cy.goToWarMode(ownerData.user_id, 'attackers');
      cy.getByCy('fight-not-done-node-10').should('have.class', 'opacity-40');
    });
  });

  it('planning-error button is visually disabled when fight-not-done is active', () => {
    setupAttackerScenario('pe-disabled-by-fnd').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiToggleFightNotDone(ownerData.access_token, allianceId, warId, 1, 10);
      cy.goToWarMode(ownerData.user_id, 'attackers');
      cy.getByCy('planning-error-node-10').should('have.class', 'opacity-40');
    });
  });

  it('clicking disabled fight-not-done button does not change its state', () => {
    setupAttackerScenario('fnd-no-state-change').then(
      ({ memberData, ownerData, allianceId, warId, championUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiTogglePlanningError(ownerData.access_token, allianceId, warId, 1, 10);
        cy.goToWarMode(ownerData.user_id, 'attackers');
        cy.getByCy('fight-not-done-node-10')
          .should('have.class', 'opacity-40')
          .should('not.have.class', 'bg-amber-500');
        cy.getByCy('fight-not-done-node-10').click({ force: true });
        cy.getByCy('fight-not-done-node-10')
          .should('have.class', 'opacity-40')
          .should('not.have.class', 'bg-amber-500');
      },
    );
  });

  it('clicking disabled planning-error button does not change its state', () => {
    setupAttackerScenario('pe-no-state-change').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiToggleFightNotDone(ownerData.access_token, allianceId, warId, 1, 10);
      cy.goToWarMode(ownerData.user_id, 'attackers');
      cy.getByCy('planning-error-node-10').should('have.class', 'opacity-40').should('not.have.class', 'bg-amber-500');
      cy.getByCy('planning-error-node-10').click({ force: true });
      cy.getByCy('planning-error-node-10').should('have.class', 'opacity-40').should('not.have.class', 'bg-amber-500');
    });
  });
});
