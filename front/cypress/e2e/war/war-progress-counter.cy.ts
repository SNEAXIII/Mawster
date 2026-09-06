import { type AttackerScenario, setupAssignedAttacker, setupAttackerScenario } from '../../support/e2e';

/** Open the attacker panel on a war that already has an attacker on BG1 node 10. */
function openWarWithAttacker(prefix: string, prepare?: (scenario: AttackerScenario) => void) {
  return setupAssignedAttacker(prefix).then((scenario) => {
    prepare?.(scenario);
    cy.goToWarMode(scenario.ownerData.user_id, 'attackers');
  });
}

function expectCounter(fights: string, kos: string) {
  cy.getByCy('war-progress-total').should('have.text', fights);
  cy.getByCy('war-progress-ko').should('contain.text', kos);
}

describe('War – Progress counter', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows an empty counter on a war where nothing has been fought', () => {
    setupAttackerScenario('wp-empty').then(({ ownerData }) => {
      cy.goToWarMode(ownerData.user_id, 'attackers');
    });

    expectCounter('0/150', '0 KO');
    cy.getByCy('war-progress-bg-1').should('contain.text', '0/50');
    cy.getByCy('war-progress-bg-2').should('contain.text', '0/50');
    cy.getByCy('war-progress-bg-3').should('contain.text', '0/50');
  });

  it('counts a completed fight and its KOs', () => {
    openWarWithAttacker('wp-done', ({ memberData, allianceId, warId }) => {
      cy.apiUpdateWarKo(memberData.access_token, allianceId, warId, 1, 10, 3);
      cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
    });

    expectCounter('1/150', '3 KO');
    cy.getByCy('war-progress-bg-1').should('contain.text', '1/50');
  });

  it('counts a fight flagged as not fought as handled', () => {
    openWarWithAttacker('wp-fnd', ({ ownerData, allianceId, warId }) => {
      cy.apiToggleFightNotDone(ownerData.access_token, allianceId, warId, 1, 10);
    });

    expectCounter('1/150', '0 KO');
  });

  it('leaves an assigned but unfinished fight out of the counter', () => {
    openWarWithAttacker('wp-assigned', ({ memberData, allianceId, warId }) => {
      cy.apiUpdateWarKo(memberData.access_token, allianceId, warId, 1, 10, 2);
    });

    expectCounter('0/150', '2 KO');
  });

  // ── Live updates, without waiting for the 10s poll ───────────────────────

  it('moves the counter as soon as a KO is added from the panel', () => {
    openWarWithAttacker('wp-live');

    expectCounter('0/150', '0 KO');
    cy.getByCy('ko-inc-node-10').click();

    expectCounter('0/150', '1 KO');
    cy.getByCy('war-progress-bg-1').should('contain.text', '0/50 · 1');
  });

  it('moves the counter as soon as a fight is completed from the panel', () => {
    openWarWithAttacker('wp-live-done');

    expectCounter('0/150', '0 KO');
    cy.getByCy('combat-complete-node-10').click();

    expectCounter('1/150', '0 KO');
    cy.getByCy('war-progress-bg-1').should('contain.text', '1/50');
  });
});
