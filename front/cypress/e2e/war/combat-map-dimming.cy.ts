import { setupAttackerScenario } from '../../support/e2e';

describe('War – Combat filter map dimming', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('filter "todo" dims done node on map', () => {
    setupAttackerScenario('map-todo-dim-done').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
      cy.goToWarMode(ownerData.user_id, 'attackers');

      cy.getByCy('war-combat-filter').click({ force: true });
      cy.contains('To do').click({ force: true });

      cy.getByCy('war-node-10').should('have.class', 'opacity-25');
    });
  });

  it('filter "todo" does not dim todo node on map', () => {
    setupAttackerScenario('map-todo-no-dim-todo').then(
      ({ memberData, ownerData, allianceId, warId, championUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.goToWarMode(ownerData.user_id, 'attackers');

        cy.getByCy('war-combat-filter').click({ force: true });
        cy.contains('To do').click({ force: true });

        cy.getByCy('war-node-10').should('not.have.class', 'opacity-25');
      },
    );
  });

  it('filter "done" dims todo node on map', () => {
    setupAttackerScenario('map-done-dim-todo').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.goToWarMode(ownerData.user_id, 'attackers');

      cy.getByCy('war-combat-filter').click({ force: true });
      cy.contains('Done').click({ force: true });

      cy.getByCy('war-node-10').should('have.class', 'opacity-25');
    });
  });

  it('filter "done" does not dim done node on map', () => {
    setupAttackerScenario('map-done-no-dim-done').then(
      ({ memberData, ownerData, allianceId, warId, championUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
        cy.goToWarMode(ownerData.user_id, 'attackers');

        cy.getByCy('war-combat-filter').click({ force: true });
        cy.contains('Done').click({ force: true });

        cy.getByCy('war-node-10').should('not.have.class', 'opacity-25');
      },
    );
  });

  it('filter "all" does not dim any node on map', () => {
    setupAttackerScenario('map-all-no-dim').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
      cy.goToWarMode(ownerData.user_id, 'attackers');

      cy.getByCy('war-combat-filter').click({ force: true });
      cy.contains('[role="option"]', 'All').click({ force: true });

      cy.getByCy('war-node-10').should('not.have.class', 'opacity-25');
    });
  });
});
