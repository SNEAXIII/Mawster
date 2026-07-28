import { setupAttackerScenario } from '../../support/e2e';

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
    setupAttackerScenario('fnd-appears').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.goToWarMode(ownerData.user_id, 'attackers');
      cy.getByCy('fight-not-done-node-10').should('be.visible');
    });
  });

  it('fight-not-done button is hidden for regular member', () => {
    setupAttackerScenario('fnd-member').then(({ memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiLogin(memberData.user_id);
      cy.navTo('war');
      cy.getByCy('fight-not-done-node-10').should('not.exist');
    });
  });

  // ── Fight Not Done: toggle ───────────────────────────────────────────────

  it('clicking fight-not-done button marks node as not done', () => {
    setupAttackerScenario('fnd-toggle-on').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.goToWarMode(ownerData.user_id, 'attackers');
      cy.getByCy('fight-not-done-node-10').click();
      cy.getByCy('fight-not-done-node-10').should('have.class', 'bg-amber-500');
    });
  });

  it('clicking fight-not-done button again unmarks the node', () => {
    setupAttackerScenario('fnd-toggle-off').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiToggleFightNotDone(ownerData.access_token, allianceId, warId, 1, 10);
      cy.goToWarMode(ownerData.user_id, 'attackers');
      cy.getByCy('fight-not-done-node-10').click();
      cy.getByCy('fight-not-done-node-10').should('not.have.class', 'bg-amber-500');
    });
  });

  it('fight-not-done button is hidden after combat is completed', () => {
    setupAttackerScenario('fnd-hidden-completed').then(
      ({ memberData, ownerData, allianceId, warId, championUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
        cy.goToWarMode(ownerData.user_id, 'attackers');
        cy.getByCy('fight-not-done-node-10').should('not.exist');
      },
    );
  });
});
