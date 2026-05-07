import { setupAttackerScenario } from '../../support/e2e';

function goToAttackersMode(userId: string) {
  cy.apiLogin(userId);
  cy.navTo('war');
  cy.getByCy('war-mode-attackers').click();
}

describe('War – Fight Not Done & Planning Error', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Fight Not Done: visibility ───────────────────────────────────────────

  it('fight-not-done button is hidden when no attacker is assigned', () => {
    setupAttackerScenario('fnd-no-atk').then(({ ownerData }) => {
      goToAttackersMode(ownerData.user_id);
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('fight-not-done-node-10').should('not.exist');
    });
  });

  it('fight-not-done button appears for officer after attacker is assigned', () => {
    setupAttackerScenario('fnd-appears').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);
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
      goToAttackersMode(ownerData.user_id);
      cy.getByCy('fight-not-done-node-10').click();
      cy.getByCy('fight-not-done-node-10').should('have.class', 'bg-amber-500');
    });
  });

  it('clicking fight-not-done button again unmarks the node', () => {
    setupAttackerScenario('fnd-toggle-off').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiToggleFightNotDone(ownerData.access_token, allianceId, warId, 1, 10);
      goToAttackersMode(ownerData.user_id);
      cy.getByCy('fight-not-done-node-10').click();
      cy.getByCy('fight-not-done-node-10').should('not.have.class', 'bg-amber-500');
    });
  });

  it('fight-not-done button is hidden after combat is completed', () => {
    setupAttackerScenario('fnd-hidden-completed').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
      goToAttackersMode(ownerData.user_id);
      cy.getByCy('fight-not-done-node-10').should('not.exist');
    });
  });

  // ── Planning Error: visibility ───────────────────────────────────────────

  it('planning-error button is hidden when no attacker is assigned', () => {
    setupAttackerScenario('pe-no-atk').then(({ ownerData }) => {
      goToAttackersMode(ownerData.user_id);
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('planning-error-node-10').should('not.exist');
    });
  });

  it('planning-error button appears for officer after attacker is assigned', () => {
    setupAttackerScenario('pe-appears').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);
      cy.getByCy('planning-error-node-10').should('be.visible');
    });
  });

  it('planning-error button is hidden for regular member', () => {
    setupAttackerScenario('pe-member').then(({ memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiLogin(memberData.user_id);
      cy.navTo('war');
      cy.getByCy('planning-error-node-10').should('not.exist');
    });
  });

  // ── Planning Error: toggle ───────────────────────────────────────────────

  it('clicking planning-error button marks node as planning error', () => {
    setupAttackerScenario('pe-toggle-on').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);
      cy.getByCy('planning-error-node-10').click();
      cy.getByCy('planning-error-node-10').should('have.class', 'bg-amber-500');
    });
  });

  it('clicking planning-error button again unmarks the node', () => {
    setupAttackerScenario('pe-toggle-off').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiTogglePlanningError(ownerData.access_token, allianceId, warId, 1, 10);
      goToAttackersMode(ownerData.user_id);
      cy.getByCy('planning-error-node-10').click();
      cy.getByCy('planning-error-node-10').should('not.have.class', 'bg-amber-500');
    });
  });

  // ── Mutual exclusion ─────────────────────────────────────────────────────

  it('fight-not-done button is visually disabled when planning-error is active', () => {
    setupAttackerScenario('fnd-disabled-by-pe').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiTogglePlanningError(ownerData.access_token, allianceId, warId, 1, 10);
      goToAttackersMode(ownerData.user_id);
      cy.getByCy('fight-not-done-node-10').should('have.class', 'opacity-40');
    });
  });

  it('planning-error button is visually disabled when fight-not-done is active', () => {
    setupAttackerScenario('pe-disabled-by-fnd').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiToggleFightNotDone(ownerData.access_token, allianceId, warId, 1, 10);
      goToAttackersMode(ownerData.user_id);
      cy.getByCy('planning-error-node-10').should('have.class', 'opacity-40');
    });
  });

  it('clicking disabled fight-not-done button does not change its state', () => {
    setupAttackerScenario('fnd-no-state-change').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiTogglePlanningError(ownerData.access_token, allianceId, warId, 1, 10);
      goToAttackersMode(ownerData.user_id);
      cy.getByCy('fight-not-done-node-10')
        .should('have.class', 'opacity-40')
        .should('not.have.class', 'bg-amber-500');
      cy.getByCy('fight-not-done-node-10').click({ force: true });
      cy.getByCy('fight-not-done-node-10')
        .should('have.class', 'opacity-40')
        .should('not.have.class', 'bg-amber-500');
    });
  });

  it('clicking disabled planning-error button does not change its state', () => {
    setupAttackerScenario('pe-no-state-change').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiToggleFightNotDone(ownerData.access_token, allianceId, warId, 1, 10);
      goToAttackersMode(ownerData.user_id);
      cy.getByCy('planning-error-node-10')
        .should('have.class', 'opacity-40')
        .should('not.have.class', 'bg-amber-500');
      cy.getByCy('planning-error-node-10').click({ force: true });
      cy.getByCy('planning-error-node-10')
        .should('have.class', 'opacity-40')
        .should('not.have.class', 'bg-amber-500');
    });
  });
});
