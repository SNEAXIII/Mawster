import { setupUser } from '../../support/e2e';

describe('Game Accounts – Edge Cases', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Pseudo length validation (2–16 chars)
  // =========================================================================

  it('rejects a pseudo shorter than 2 characters (API)', () => {
    setupUser('ga-short-token').then(({ access_token }) => {
      cy.apiRequest(
        access_token,
        'POST',
        '/game-accounts',
        { game_pseudo: 'A', is_primary: true },
        { failOnStatusCode: false },
      ).then((res) => {
        expect(res.status).to.eq(422);
      });
    });
  });

  it('rejects an empty pseudo (API)', () => {
    setupUser('ga-empty-pseudo-token').then(({ access_token }) => {
      cy.apiRequest(
        access_token,
        'POST',
        '/game-accounts',
        { game_pseudo: '', is_primary: true },
        { failOnStatusCode: false },
      ).then((res) => {
        expect(res.status).to.eq(422);
      });
    });
  });

  it('accepts a pseudo of exactly 2 characters (API)', () => {
    setupUser('ga-min2-token').then(({ access_token }) => {
      cy.apiRequest(access_token, 'POST', '/game-accounts', { game_pseudo: 'AB', is_primary: true }).then((res) => {
        expect(res.status).to.eq(201);
        expect(res.body.game_pseudo).to.eq('AB');
      });
    });
  });

  it('accepts a pseudo of exactly 16 characters (API)', () => {
    setupUser('ga-max16-token').then(({ access_token }) => {
      const pseudo16 = 'A'.repeat(16);
      cy.apiRequest(access_token, 'POST', '/game-accounts', { game_pseudo: pseudo16, is_primary: true }).then((res) => {
        expect(res.status).to.eq(201);
        expect(res.body.game_pseudo).to.eq(pseudo16);
      });
    });
  });

  it('rejects a pseudo longer than 16 characters (API)', () => {
    setupUser('ga-toolong-token').then(({ access_token }) => {
      const pseudo17 = 'A'.repeat(17);
      cy.apiRequest(
        access_token,
        'POST',
        '/game-accounts',
        { game_pseudo: pseudo17, is_primary: true },
        { failOnStatusCode: false },
      ).then((res) => {
        expect(res.status).to.eq(422);
      });
    });
  });
});
