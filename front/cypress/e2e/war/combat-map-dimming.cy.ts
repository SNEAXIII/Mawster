import { setupAssignedAttacker } from '../../support/e2e';

describe('War – Combat filter map dimming', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  function selectCombatFilter(label: string) {
    cy.getByCy('war-combat-filter').click({ force: true });
    cy.contains(label).click({ force: true });
  }

  // Node 10 carries the assigned attacker; `completed` decides which side of the
  // todo/done filter it falls on.
  function openAttackersView(prefix: string, completed: boolean) {
    return setupAssignedAttacker(prefix).then(({ memberData, ownerData, allianceId, warId }) => {
      if (completed) cy.apiToggleCombatCompleted(memberData.access_token, allianceId, warId, 1, 10);
      cy.goToWarMode(ownerData.user_id, 'attackers');
    });
  }

  it('filter "todo" dims done node on map', () => {
    openAttackersView('map-todo-dim-done', true).then(() => {
      selectCombatFilter('To do');
      cy.getByCy('war-node-10').should('have.class', 'opacity-25');
    });
  });

  it('filter "todo" does not dim todo node on map', () => {
    openAttackersView('map-todo-no-dim-todo', false).then(() => {
      selectCombatFilter('To do');
      cy.getByCy('war-node-10').should('not.have.class', 'opacity-25');
    });
  });

  it('filter "done" dims todo node on map', () => {
    openAttackersView('map-done-dim-todo', false).then(() => {
      selectCombatFilter('Done');
      cy.getByCy('war-node-10').should('have.class', 'opacity-25');
    });
  });

  it('filter "done" does not dim done node on map', () => {
    openAttackersView('map-done-no-dim-done', true).then(() => {
      selectCombatFilter('Done');
      cy.getByCy('war-node-10').should('not.have.class', 'opacity-25');
    });
  });

  it('filter "all" does not dim any node on map', () => {
    openAttackersView('map-all-no-dim', true).then(() => {
      cy.getByCy('war-combat-filter').click({ force: true });
      cy.get('[role="listbox"]').should('be.visible');
      cy.contains('[role="option"]', 'All').click({ force: true });
      cy.getByCy('war-node-10').should('not.have.class', 'opacity-25');
    });
  });
});
