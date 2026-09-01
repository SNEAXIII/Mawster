import { openStatsAs, setupStatsOwner, withEndedWarStats } from './statistics-helpers';

describe('Alliance Statistics – Empty states & Happy path', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Empty states ──────────────────────────────────────────────────────────

  it('shows empty state when no wars have been played', () => {
    setupStatsOwner('stat-empty').then(({ ownerUserId }) => {
      openStatsAs(ownerUserId);
      cy.getByCy('statistics-empty').should('be.visible');
    });
  });

  it('shows empty state when only an active (ongoing) war exists', () => {
    withEndedWarStats(
      'stat-act',
      () => {
        cy.getByCy('statistics-empty').should('be.visible');
      },
      { endWar: false },
    );
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('shows statistics table after an ended war', () => {
    withEndedWarStats('stat-hp', () => {
      cy.getByCy('statistics-table').should('be.visible');
      cy.getByCy('statistics-table').find('tbody tr').should('have.length', 1);
    });
  });

  it('shows correct fight count and ratio for a player with a KO', () => {
    withEndedWarStats(
      'stat-ko',
      () => {
        cy.getByCy('statistics-table')
          .find('tbody tr')
          .first()
          .within(() => {
            cy.contains('1').should('exist'); // total_fights
            cy.contains('0%').should('exist'); // ratio = (1 - 1/1) * 100
          });
      },
      { koCount: 1 },
    );
  });
});
