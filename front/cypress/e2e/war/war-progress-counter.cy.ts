import { setupAssignedAttacker, setupAttackerScenario } from '../../support/e2e';

describe('War – Progress counter', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Empty war ────────────────────────────────────────────────────────────

  it('shows an empty counter on a war where nothing has been fought', () => {
    setupAttackerScenario('wp-empty').then(({ ownerData }) => {
      cy.goToWarMode(ownerData.user_id, 'attackers');

      cy.getByCy('war-progress-total').should('have.text', '0/150');
      cy.getByCy('war-progress-ko').should('contain.text', '0 KO');
      cy.getByCy('war-progress-bg-1').should('contain.text', '0/50');
      cy.getByCy('war-progress-bg-2').should('contain.text', '0/50');
      cy.getByCy('war-progress-bg-3').should('contain.text', '0/50');
    });
  });

  // ── Completed fight ──────────────────────────────────────────────────────

  it('counts a completed fight and its KOs', () => {
    setupAssignedAttacker('wp-done').then(({ memberData, ownerData, allianceId, warId }) => {
      cy.apiUpdateWarKo(memberData.access_token, allianceId, warId, 1, 10, 3);
      cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
      cy.goToWarMode(ownerData.user_id, 'attackers');

      cy.getByCy('war-progress-total').should('have.text', '1/150');
      cy.getByCy('war-progress-ko').should('contain.text', '3 KO');
      cy.getByCy('war-progress-bg-1').should('contain.text', '1/50');
    });
  });

  // ── Fight flagged as not fought ──────────────────────────────────────────

  it('counts a fight flagged as not fought as handled', () => {
    setupAssignedAttacker('wp-fnd').then(({ ownerData, allianceId, warId }) => {
      cy.apiToggleFightNotDone(ownerData.access_token, allianceId, warId, 1, 10);
      cy.goToWarMode(ownerData.user_id, 'attackers');

      cy.getByCy('war-progress-total').should('have.text', '1/150');
      cy.getByCy('war-progress-ko').should('contain.text', '0 KO');
    });
  });

  // ── An assigned fight is not a done fight ────────────────────────────────

  it('leaves an assigned but unfinished fight out of the counter', () => {
    setupAssignedAttacker('wp-assigned').then(({ memberData, ownerData, allianceId, warId }) => {
      cy.apiUpdateWarKo(memberData.access_token, allianceId, warId, 1, 10, 2);
      cy.goToWarMode(ownerData.user_id, 'attackers');

      cy.getByCy('war-progress-total').should('have.text', '0/150');
      cy.getByCy('war-progress-ko').should('contain.text', '2 KO');
    });
  });

  // ── Live update, without waiting for the 10s poll ────────────────────────

  it('moves the counter as soon as a KO is added from the panel', () => {
    setupAssignedAttacker('wp-live').then(({ ownerData }) => {
      cy.goToWarMode(ownerData.user_id, 'attackers');

      cy.getByCy('war-progress-ko').should('contain.text', '0 KO');
      cy.getByCy('ko-inc-node-10').click();

      cy.getByCy('war-progress-ko').should('contain.text', '1 KO');
      cy.getByCy('war-progress-bg-1').should('contain.text', '0/50 · 1');
    });
  });

  it('moves the counter as soon as a fight is completed from the panel', () => {
    setupAssignedAttacker('wp-live-done').then(({ ownerData }) => {
      cy.goToWarMode(ownerData.user_id, 'attackers');

      cy.getByCy('war-progress-total').should('have.text', '0/150');
      cy.getByCy('combat-complete-node-10').click();

      cy.getByCy('war-progress-total').should('have.text', '1/150');
      cy.getByCy('war-progress-bg-1').should('contain.text', '1/50');
    });
  });
});
