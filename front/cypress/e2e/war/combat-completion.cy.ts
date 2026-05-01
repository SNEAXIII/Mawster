import { setupAttackerScenario } from '../../support/e2e';

function goToAttackersMode(userId: string) {
  cy.apiLogin(userId);
  cy.navTo('war');
  cy.getByCy('war-mode-attackers').click();
}

describe('War – Combat completion', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Toggle button visible only after attacker assigned ───────────────────

  it('combat complete button is hidden when no attacker is assigned', () => {
    setupAttackerScenario('cc-no-attacker').then(({ ownerData }) => {
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('attacker-entry-node-10').should('be.visible');
      cy.getByCy('combat-complete-node-10').should('not.exist');
    });
  });

  it('combat complete button appears after attacker is assigned', () => {
    setupAttackerScenario('cc-btn-appear').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('combat-complete-node-10').should('be.visible');
    });
  });

  // ── Toggle on ────────────────────────────────────────────────────────────

  it('clicking complete button marks the combat as done', () => {
    setupAttackerScenario('cc-toggle-on').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('combat-complete-node-10').click();
      cy.getByCy('attacker-entry-node-10').should('have.attr', 'data-attacker');
      cy.getByCy('ko-counter-node-10').should('not.exist');
      cy.getByCy('remove-attacker-node-10').should('not.exist');
    });
  });

  // ── Toggle off ───────────────────────────────────────────────────────────

  it('clicking complete button again unmarks the combat', () => {
    setupAttackerScenario('cc-toggle-off').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('combat-complete-node-10').click();
      cy.getByCy('combat-complete-node-10').click();

      cy.getByCy('ko-counter-node-10').should('be.visible');
      cy.getByCy('remove-attacker-node-10').should('be.visible');
    });
  });

  // ── KO and remove hidden when completed ──────────────────────────────────

  it('ko counter and remove button are hidden when combat is completed', () => {
    setupAttackerScenario('cc-locked-ui').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('ko-counter-node-10').should('not.exist');
      cy.getByCy('remove-attacker-node-10').should('not.exist');
    });
  });

  // ── Combat filter: done ──────────────────────────────────────────────────

  it('filter "done" shows completed entries and dims todo ones', () => {
    setupAttackerScenario('cc-filter-done').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-combat-filter').click({ force: true });
      cy.contains('Done').click({ force: true });

      cy.getByCy('attacker-entry-node-10').should('be.visible');
    });
  });

  // ── Combat filter: todo ──────────────────────────────────────────────────

  it('filter "todo" dims completed entries instead of hiding them', () => {
    setupAttackerScenario('cc-filter-todo').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-combat-filter').click({ force: true });
      cy.contains('To do').click({ force: true });

      cy.getByCy('attacker-entry-node-10').should('be.visible');
      cy.getByCy('attacker-entry-node-10').parent().should('have.class', 'opacity-40');
    });
  });

  it('filter "todo" shows entries that are not completed', () => {
    setupAttackerScenario('cc-filter-todo-visible').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-combat-filter').click({ force: true });
      cy.contains('To do').click({ force: true });

      cy.getByCy('attacker-entry-node-10').should('be.visible');
    });
  });

  it('filter "todo" does not dim todo entries', () => {
    setupAttackerScenario('cc-todo-no-dim').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-combat-filter').click({ force: true });
      cy.contains('To do').click({ force: true });

      cy.getByCy('attacker-entry-node-10').parent().should('not.have.class', 'opacity-40');
    });
  });

  it('filter "done" dims todo entries', () => {
    setupAttackerScenario('cc-done-dim-todo').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-combat-filter').click({ force: true });
      cy.contains('Done').click({ force: true });

      cy.getByCy('attacker-entry-node-10').parent().should('have.class', 'opacity-40');
    });
  });

  it('filter "done" does not dim completed entries', () => {
    setupAttackerScenario('cc-done-no-dim').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-combat-filter').click({ force: true });
      cy.contains('Done').click({ force: true });

      cy.getByCy('attacker-entry-node-10').parent().should('not.have.class', 'opacity-40');
    });
  });

  it('filter "all" does not dim any entries', () => {
    setupAttackerScenario('cc-all-no-dim').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-combat-filter').click({ force: true });
      cy.contains('All').click({ force: true });

      cy.getByCy('attacker-entry-node-10').parent().should('not.have.class', 'opacity-40');
    });
  });
});

// ── Map dimming ────────────────────────────────────────────────────────────────

describe('War – Combat filter map dimming', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('filter "todo" dims done node on map', () => {
    setupAttackerScenario('map-todo-dim-done').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-combat-filter').click({ force: true });
      cy.contains('To do').click({ force: true });

      cy.getByCy('war-node-10').should('have.class', 'opacity-25');
    });
  });

  it('filter "todo" does not dim todo node on map', () => {
    setupAttackerScenario('map-todo-no-dim-todo').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-combat-filter').click({ force: true });
      cy.contains('To do').click({ force: true });

      cy.getByCy('war-node-10').should('not.have.class', 'opacity-25');
    });
  });

  it('filter "done" dims todo node on map', () => {
    setupAttackerScenario('map-done-dim-todo').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-combat-filter').click({ force: true });
      cy.contains('Done').click({ force: true });

      cy.getByCy('war-node-10').should('have.class', 'opacity-25');
    });
  });

  it('filter "done" does not dim done node on map', () => {
    setupAttackerScenario('map-done-no-dim-done').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-combat-filter').click({ force: true });
      cy.contains('Done').click({ force: true });

      cy.getByCy('war-node-10').should('not.have.class', 'opacity-25');
    });
  });

  it('filter "all" does not dim any node on map', () => {
    setupAttackerScenario('map-all-no-dim').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-combat-filter').click({ force: true });
      cy.contains('All').click({ force: true });

      cy.getByCy('war-node-10').should('not.have.class', 'opacity-25');
    });
  });
});
