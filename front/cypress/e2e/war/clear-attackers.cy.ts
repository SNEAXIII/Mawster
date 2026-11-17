import { setupAttackerScenario, type AttackerScenario } from '../../support/e2e';

// Defenders on nodes 10, 1 and 2; the member's Wolverine on 10 (completed), Thor on 1 (unfinished).
function setupClearAttackers(prefix: string): Cypress.Chainable<AttackerScenario> {
  return setupAttackerScenario(prefix, {
    champions: [
      { name: 'Gamora', champion_class: 'Cosmic' },
      { name: 'Hulk', champion_class: 'Science' },
      { name: 'Thor', champion_class: 'Cosmic' },
    ],
    memberRoster: [{ champion: 'Thor', rarity: '7r3' }],
  }).then((s) => {
    const token = s.ownerData.access_token;
    cy.apiPlaceWarDefender(token, s.allianceId, s.warId, 1, 1, s.championIds['Gamora'], 7, 3, 0);
    cy.apiPlaceWarDefender(token, s.allianceId, s.warId, 1, 2, s.championIds['Hulk'], 7, 3, 0);
    cy.apiAssignWarAttacker(s.memberData.access_token, s.allianceId, s.warId, 1, 10, s.championUserId);
    cy.apiAssignWarAttacker(s.memberData.access_token, s.allianceId, s.warId, 1, 1, s.memberChampionUserIds['Thor']);
    cy.apiToggleCombatCompleted(token, s.allianceId, s.warId, 1, 10);
    return cy.wrap(s, { log: false });
  });
}

describe('War – Clear unfinished attackers', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('strategist clears unfinished attackers and keeps completed fights and defenders', () => {
    setupClearAttackers('war-clear-atk').then(({ ownerData }) => {
      cy.goToWarMode(ownerData.user_id, 'attackers');

      cy.getByCy('clear-war-attackers-btn').should('be.visible').click();
      cy.getByCy('clear-war-attackers-dialog')
        .invoke('text')
        .should('match', /\b1 unfinished\b.*\b1 completed\b/);
      cy.getByCy('confirmation-dialog-confirm').click();

      // The attacker panel only lists nodes that still hold an attacker.
      cy.get('[data-cy^="attacker-entry-node-"]').should(($els) => {
        const rows = [...$els].map((el) => [el.dataset.cy, el.dataset.attacker]);
        expect(rows).to.deep.eq([['attacker-entry-node-10', 'Wolverine']]);
      });
      cy.getByCy('clear-war-attackers-btn').should('not.exist');

      cy.getByCy('war-mode-defenders').click();
      for (const node of [1, 2, 10]) {
        cy.getByCy(`war-node-${node}`).should('not.contain', '+');
      }
    });
  });

  it('a plain member does not see the clear attackers button', () => {
    setupClearAttackers('war-clear-atk-mem').then(({ memberData }) => {
      cy.goToWarMode(memberData.user_id, 'attackers');

      cy.getByCy('attacker-entry-node-1').should('have.attr', 'data-attacker', 'Thor');
      cy.getByCy('clear-war-attackers-btn').should('not.exist');
    });
  });
});
