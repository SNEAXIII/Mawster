import { setupWarOwner, openWarNode } from '../../support/e2e';

const PAGE_SIZE = 60;
const TOTAL = PAGE_SIZE + 5;

describe('War – defender selector paging', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('"Load more" appends the next page of champions', () => {
    setupWarOwner('def-more', 'MoreOwner', 'MoreAlliance', 'MO').then(({ adminData, ownerData, allianceId }) => {
      cy.apiLoadChampions(
        adminData.access_token,
        Array.from({ length: TOTAL }, (_, i) => ({ name: `Bulk Hero ${String(i).padStart(2, '0')}`, cls: 'Tech' })),
      );
      cy.apiCreateWar(ownerData.access_token, allianceId, 'PagedEnemy');

      cy.goToWarMode(ownerData.user_id, 'defenders');
      openWarNode(1);

      cy.get('[data-cy^="war-champion-card-"]').should('have.length', PAGE_SIZE);
      cy.getByCy('war-champion-load-more').click();
      cy.get('[data-cy^="war-champion-card-"]').should('have.length', TOTAL);
      cy.get('[data-cy="war-champion-load-more"]').should('not.exist');
    });
  });
});
