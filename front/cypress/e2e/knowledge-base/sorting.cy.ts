import { setupKnowledgeBaseFast } from '../../support/e2e';

// Read the Node cell by selector, never by column index: a reorder would keep
// reading a neighbouring cell, and Number('') === 0 would make the sort
// assertions pass on every row silently.
function cellNumbers($rows: JQuery<HTMLElement>, cellCy: string): number[] {
  return [...$rows].map(($row) => {
    const cell = $row.querySelector(`[data-cy="${cellCy}"]`);
    assert.isNotNull(cell, cellCy);
    return Number(cell?.textContent?.trim());
  });
}

// Rows stay on screen while the table refetches, so the order is read inside a
// retried should(): a one-shot then() would read the previous sort.
function expectSorted(cellCy: string, direction: 'desc' | 'asc') {
  cy.get('[data-cy="fight-records-table"] tbody tr').should(($rows) => {
    const [first, second] = cellNumbers($rows, cellCy);
    if (direction === 'desc') expect(first).to.be.at.least(second);
    else expect(first).to.be.at.most(second);
  });
}

const SORTS = [
  { label: 'KO count', header: 'KO', cellCy: 'fight-record-ko', prefix: 'kb-sort' },
  { label: 'node number', header: 'Node', cellCy: 'fight-record-node', prefix: 'kb-sortnode' },
] as const;

// Dev endpoint alternates champions per node:
//   odd  nodes: attacker=Iron Man,       defender=Captain America
//   even nodes: attacker=Captain America, defender=Iron Man

describe('Knowledge Base', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  SORTS.forEach(({ label, header, cellCy, prefix }) => {
    it(`sorts by ${label} descending then ascending`, () => {
      setupKnowledgeBaseFast(prefix).then(({ userData }) => {
        cy.apiLogin(userData.user_id, 'knowledge-base');
        cy.get('[data-cy="fight-records-table"] tbody tr').should('have.length', 2);

        cy.contains('th', header).click();
        expectSorted(cellCy, 'desc');

        cy.contains('th', header).click();
        expectSorted(cellCy, 'asc');
      });
    });
  });
});
