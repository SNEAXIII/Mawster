import { setupKnowledgeBaseFast, setupKnowledgeBase } from '../../support/e2e';

// Read the Node cell by selector, never by column index: a reorder would keep
// reading a neighbouring cell, and Number('') === 0 would make the sort
// assertions pass on every row silently.
function nodeNumbers($rows: JQuery<HTMLElement>): number[] {
  return [...$rows].map(($row) => {
    const cell = $row.querySelector('[data-cy="fight-record-node"]');
    expect(cell, 'node cell').to.exist;
    return Number(cell?.textContent?.trim());
  });
}

// Dev endpoint alternates champions per node:
//   odd  nodes: attacker=Iron Man,       defender=Captain America
//   even nodes: attacker=Captain America, defender=Iron Man

describe('Knowledge Base', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('sorts by KO count descending then ascending', () => {
    setupKnowledgeBaseFast('kb-sort').then(({ userData }) => {
      cy.apiLogin(userData.user_id, 'knowledge-base');

      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);

      cy.contains('th', 'KO').click();
      cy.getByCy('fight-records-table')
        .find('tbody tr')
        .then(($rows) => {
          const kos = [...$rows].map((r) =>
            Number(r.querySelector('[data-cy="fight-record-ko"]')?.textContent?.trim() ?? '0'),
          );
          expect(kos[0]).to.be.at.least(kos[1]);
        });

      cy.contains('th', 'KO').click();
      cy.getByCy('fight-records-table')
        .find('tbody tr')
        .then(($rows) => {
          const kos = [...$rows].map((r) =>
            Number(r.querySelector('[data-cy="fight-record-ko"]')?.textContent?.trim() ?? '0'),
          );
          expect(kos[0]).to.be.at.most(kos[1]);
        });
    });
  });

  it('sorts by node number descending then ascending', () => {
    setupKnowledgeBaseFast('kb-sortnode').then(({ userData }) => {
      cy.apiLogin(userData.user_id, 'knowledge-base');

      cy.contains('th', 'Node').click();
      cy.getByCy('fight-records-table')
        .find('tbody tr')
        .then(($rows) => {
          const nodes = nodeNumbers($rows);
          expect(nodes[0]).to.be.at.least(nodes[1]);
        });

      cy.contains('th', 'Node').click();
      cy.getByCy('fight-records-table')
        .find('tbody tr')
        .then(($rows) => {
          const nodes = nodeNumbers($rows);
          expect(nodes[0]).to.be.at.most(nodes[1]);
        });
    });
  });
});
