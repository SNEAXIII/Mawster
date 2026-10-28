import { openWarNode, setupAssignedAttacker, setupAttackerScenario } from '../../support/e2e';

function pickDefender(node: number, name: string) {
  openWarNode(node);
  cy.getByCy('war-champion-search').type(name);
  cy.getByCy(`war-champion-card-${name.replaceAll(' ', '-')}`).click();
}

describe('War – defender selector sliders', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('remembers the last rank and ascension for the next defender', () => {
    const thor = { name: 'Thor', champion_class: 'Cosmic', is_ascendable: true };
    setupAttackerScenario('war-def-sliders', { champions: [thor] }).then(({ ownerData }) => {
      cy.goToWarMode(ownerData.user_id, 'defenders');

      pickDefender(11, 'Thor');
      cy.getByCy('war-defender-rank-value').should('have.text', '7R3');
      cy.slideTo('war-defender-rank', '7R5');
      cy.slideTo('war-defender-ascension', 'A1');
      cy.getByCy('war-confirm-place').click();
      cy.contains('placed on node #11').should('be.visible');

      pickDefender(12, 'Thor');
      cy.getByCy('war-defender-rank-value').should('have.text', '7R5');
      cy.getByCy('war-defender-ascension-value').should('have.text', 'A1');
    });
  });

  it('re-picking the same defender over an attacker asks nothing and keeps the attacker', () => {
    setupAssignedAttacker('war-def-same').then(({ ownerData }) => {
      cy.goToWarMode(ownerData.user_id, 'defenders');

      pickDefender(10, 'Iron Man');
      cy.slideTo('war-defender-rank', '7R4');
      cy.getByCy('war-confirm-place').click();

      cy.getByCy('confirmation-dialog-confirm').should('not.exist');
      cy.contains('placed on node #10').should('be.visible');
      cy.getByCy('war-mode-attackers').click();
      cy.getByCy('attacker-entry-node-10').should('have.attr', 'data-attacker', 'Wolverine');
    });
  });
});
