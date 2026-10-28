import { setupAssignedAttacker, setupAttackerScenario, setupWarOwner, sliderThumb } from '../../support/e2e';

function openQuickEdit(userId: string) {
  cy.apiLogin(userId, 'war');
  cy.getByCy('war-quick-edit-btn').click();
  cy.getByCy('war-quick-edit').should('be.visible');
}

function pickChampion(node: number, name: string) {
  cy.getByCy(`war-quick-edit-champion-${node}`).click();
  cy.get(`[data-cy="war-quick-edit-champion-${node}-item"][data-cy-champion="${name}"]`).click();
}

const rows = () => cy.get('[data-cy^="war-quick-edit-row-"]');

describe('War – quick edit', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('is offered to the owner only, not to a plain member', () => {
    setupAttackerScenario('war-qe-perm').then(({ ownerData, memberData }) => {
      cy.apiLogin(memberData.user_id, 'war');
      cy.getByCy('war-opponent-name').should('be.visible');
      cy.getByCy('war-quick-edit-btn').should('not.exist');

      openQuickEdit(ownerData.user_id);
      rows().should('have.length', 50);
    });
  });

  it('records defenders on empty nodes and shows them on the map', () => {
    setupAttackerScenario('war-qe-add').then(({ ownerData }) => {
      openQuickEdit(ownerData.user_id);
      pickChampion(11, 'Wolverine');
      pickChampion(12, 'Iron Man');
      cy.getByCy('war-quick-edit-status-11').should('have.attr', 'data-state', 'saved');
      cy.getByCy('war-quick-edit-status-12').should('have.attr', 'data-state', 'saved');

      cy.get('body').type('{esc}');
      cy.getByCy('war-mode-defenders').click();
      cy.getByCy('war-node-remove-11').should('exist');
      cy.getByCy('war-node-remove-12').should('exist');
    });
  });

  it('changes the rank under an attacker without asking, and asks before removing it', () => {
    setupAssignedAttacker('war-qe-attacker').then(({ ownerData }) => {
      openQuickEdit(ownerData.user_id);
      cy.slideTo('war-quick-edit-rank-10', '7R5');
      cy.getByCy('war-quick-edit-confirm').should('not.exist');
      cy.getByCy('war-quick-edit-status-10').should('have.attr', 'data-state', 'saved');

      cy.getByCy('war-quick-edit-remove-10').click();
      cy.getByCy('war-quick-edit-confirm').should('be.visible');
      cy.getByCy('confirmation-dialog-cancel').click();

      cy.get('body').type('{esc}');
      cy.getByCy('attacker-entry-node-10').should('have.attr', 'data-attacker', 'Wolverine');
    });
  });

  it('narrows the listed nodes with the node slider', () => {
    setupAttackerScenario('war-qe-slices').then(({ ownerData }) => {
      openQuickEdit(ownerData.user_id);
      sliderThumb('war-quick-edit-nodes', 1).type('{home}');
      cy.getByCy('war-quick-edit-nodes-value').should('have.text', '1 – 10');
      rows().should('have.length', 10);
      cy.getByCy('war-quick-edit-row-11').should('not.exist');
    });
  });

  it('lists 10 nodes in slices of 2 for a Big Thing war', () => {
    setupWarOwner('war-qe-bt', 'QEBTOwner', 'QEBTAlliance', 'QB').then(({ adminData, ownerData, allianceId }) => {
      cy.apiOpenBigThingSeason(adminData.access_token, 72);
      cy.apiCreateWar(ownerData.access_token, allianceId, 'QEBTEnemy');
      openQuickEdit(ownerData.user_id);
      rows().should('have.length', 10);
      sliderThumb('war-quick-edit-nodes', 1).type('{home}');
      cy.getByCy('war-quick-edit-nodes-value').should('have.text', '1 – 2');
      rows().should('have.length', 2);
    });
  });
});
