import { setupOwnerMemberAlliance } from '../../support/e2e';

describe('Alliances – Elo and tier editing on the alliance card', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('owner edits the elo and the card shows the saved value', () => {
    setupOwnerMemberAlliance('elo-edit', 'EloOwner', 'EloMember', 'EloAlliance', 'EL').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'alliances');

      cy.getByCy('alliance-card-EloAlliance').within(() => {
        cy.getByCy('alliance-elo-edit').click();
        cy.getByCy('alliance-elo-input').clear();
        cy.getByCy('alliance-elo-input').type('2350');
        cy.getByCy('alliance-elo-save').click();
        cy.get('[data-cy="alliance-elo-input"]').should('not.exist');
        cy.get('[data-cy="alliance-elo"]').should('contain.text', '2350');
      });

      cy.reload();
      cy.get('[data-cy="alliance-card-EloAlliance"] [data-cy="alliance-elo"]').should('contain.text', '2350');
    });
  });

  it('owner edits the tier and the card shows the saved value', () => {
    setupOwnerMemberAlliance('tier-edit', 'TierOwner', 'TierMember', 'TierAlliance', 'TI').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'alliances');

      cy.getByCy('alliance-card-TierAlliance').within(() => {
        cy.getByCy('alliance-tier-edit').click();
        cy.getByCy('alliance-tier-input').clear();
        cy.getByCy('alliance-tier-input').type('7');
        cy.getByCy('alliance-tier-save').click();
        cy.get('[data-cy="alliance-tier-input"]').should('not.exist');
        cy.get('[data-cy="alliance-tier"]').should('contain.text', '7');
      });

      cy.reload();
      cy.get('[data-cy="alliance-card-TierAlliance"] [data-cy="alliance-tier"]').should('contain.text', '7');
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
