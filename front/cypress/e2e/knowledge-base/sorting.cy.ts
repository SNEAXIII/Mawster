import { setupKnowledgeBaseFast, setupKnowledgeBase } from '../../support/e2e';

// Column indices (0-based):
// 0: Player | 1: Attacker | 2: Defender | 3: Synergies | 4: Prefights | 5: Node | 6: Tier | 7: KO | 8: Alliance | 9: Date
//
// Dev endpoint alternates champions per node:
//   odd  nodes: attacker=Iron Man,       defender=Captain America
//   even nodes: attacker=Captain America, defender=Iron Man

describe('Knowledge Base', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('sorts by KO count descending then ascending', () => {
    setupKnowledgeBaseFast('kb-sort').then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.visit('/game/knowledge-base');

      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);

      cy.contains('th', 'KO').click();
      cy.getByCy('fight-records-table')
        .find('tbody tr')
        .then(($rows) => {
          const kos = [...$rows].map((r) => Number(r.querySelectorAll('td')[7]?.textContent?.trim() ?? '0'));
          expect(kos[0]).to.be.at.least(kos[1]);
        });

      cy.contains('th', 'KO').click();
      cy.getByCy('fight-records-table')
        .find('tbody tr')
        .then(($rows) => {
          const kos = [...$rows].map((r) => Number(r.querySelectorAll('td')[7]?.textContent?.trim() ?? '0'));
          expect(kos[0]).to.be.at.most(kos[1]);
        });
    });
  });

  it('sorts by node number descending then ascending', () => {
    setupKnowledgeBaseFast('kb-sortnode').then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.visit('/game/knowledge-base');

      cy.contains('th', 'Node').click();
      cy.getByCy('fight-records-table')
        .find('tbody tr')
        .then(($rows) => {
          const nodes = [...$rows].map((r) => Number(r.querySelectorAll('td')[5]?.textContent?.trim() ?? '0'));
          expect(nodes[0]).to.be.at.least(nodes[1]);
        });

      cy.contains('th', 'Node').click();
      cy.getByCy('fight-records-table')
        .find('tbody tr')
        .then(($rows) => {
          const nodes = [...$rows].map((r) => Number(r.querySelectorAll('td')[5]?.textContent?.trim() ?? '0'));
          expect(nodes[0]).to.be.at.most(nodes[1]);
        });
    });
  });
});
