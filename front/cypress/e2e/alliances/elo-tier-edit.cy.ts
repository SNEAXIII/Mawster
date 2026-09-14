import { setupOwnerMemberAlliance } from '../../support/e2e';

const FIELDS = [
  { field: 'elo', prefix: 'elo-edit', value: '2350' },
  { field: 'tier', prefix: 'tier-edit', value: '7' },
] as const;

describe('Alliances – Elo and tier editing on the alliance card', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  FIELDS.forEach(({ field, prefix, value }) => {
    it(`owner edits the ${field} and the card shows the saved value`, () => {
      setupOwnerMemberAlliance(prefix, `${field}Owner`, `${field}Member`, 'EditAlliance', 'ED').then(
        ({ ownerData }) => {
          cy.apiLogin(ownerData.user_id, 'alliances');

          cy.getByCy('alliance-card-EditAlliance').within(() => {
            cy.getByCy(`alliance-${field}-edit`).click();
            cy.getByCy(`alliance-${field}-input`).clear();
            cy.getByCy(`alliance-${field}-input`).type(value);
            cy.getByCy(`alliance-${field}-save`).click();
            cy.get(`[data-cy="alliance-${field}-input"]`).should('not.exist');
            cy.get(`[data-cy="alliance-${field}"]`).should('contain.text', value);
          });

          cy.reload();
          cy.get(`[data-cy="alliance-card-EditAlliance"] [data-cy="alliance-${field}"]`).should('contain.text', value);
        },
      );
    });
  });

  it('a plain member sees the elo and tier without the edit buttons', () => {
    setupOwnerMemberAlliance('elo-ro', 'RoOwner', 'RoMember', 'RoAlliance', 'RO').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id, 'alliances');

      cy.getByCy('alliance-card-RoAlliance').within(() => {
        cy.getByCy('alliance-elo').should('be.visible');
        cy.get('[data-cy="alliance-elo-edit"]').should('not.exist');
        cy.get('[data-cy="alliance-tier-edit"]').should('not.exist');
      });
    });
  });
});
