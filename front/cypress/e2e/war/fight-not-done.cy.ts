import { setupAssignedAttacker, setupAttackerScenario } from '../../support/e2e';

describe('War – Fight Not Done', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Fight Not Done: visibility ───────────────────────────────────────────

  it('fight-not-done button is hidden when no attacker is assigned', () => {
    setupAttackerScenario('fnd-no-atk').then(({ ownerData }) => {
      cy.goToWarMode(ownerData.user_id, 'attackers');
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('fight-not-done-node-10').should('not.exist');
    });
  });

  it('fight-not-done button appears for officer after attacker is assigned', () => {
    setupAssignedAttacker('fnd-appears').then(({ ownerData }) => {
      cy.goToWarMode(ownerData.user_id, 'attackers');
      cy.getByCy('fight-not-done-node-10').should('be.visible');
    });
  });

  it('fight-not-done button is hidden for regular member', () => {
    setupAssignedAttacker('fnd-member').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id, 'war');
      cy.getByCy('fight-not-done-node-10').should('not.exist');
    });
  });

  // ── Fight Not Done: toggle ───────────────────────────────────────────────

  it('clicking fight-not-done button marks node as not done', () => {
    setupAssignedAttacker('fnd-toggle-on').then(({ ownerData }) => {
      cy.goToWarMode(ownerData.user_id, 'attackers');
      cy.getByCy('fight-not-done-node-10').click();
      cy.getByCy('fight-not-done-node-10').should('have.class', 'bg-amber-500');
    });
  });

  it('clicking fight-not-done button again unmarks the node', () => {
    setupAssignedAttacker('fnd-toggle-off').then(({ ownerData, allianceId, warId }) => {
      cy.apiToggleFightNotDone(ownerData.access_token, allianceId, warId, 1, 10);
      cy.goToWarMode(ownerData.user_id, 'attackers');
      cy.getByCy('fight-not-done-node-10').click();
      cy.getByCy('fight-not-done-node-10').should('not.have.class', 'bg-amber-500');
    });
  });

  it('fight-not-done button is hidden after combat is completed', () => {
    setupAssignedAttacker('fnd-hidden-completed').then(({ memberData, ownerData, allianceId, warId }) => {
      cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
      cy.goToWarMode(ownerData.user_id, 'attackers');
      cy.getByCy('fight-not-done-node-10').should('not.exist');
    });
  });
});
