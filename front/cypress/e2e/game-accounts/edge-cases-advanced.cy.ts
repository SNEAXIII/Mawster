import { setupUser, BACKEND } from '../../support/e2e';

describe('Game Accounts – Edge Cases (advanced)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('returns 401 without authentication', () => {
    cy.request({
      method: 'POST',
      url: `${BACKEND}/game-accounts`,
      body: { game_pseudo: 'NoAuth', is_primary: false },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });

  it("returns 403 when deleting another user's account", () => {
    setupUser('ga-owner-a-token').then(({ access_token }) => {
      cy.apiCreateGameAccount(access_token, 'OwnerAcc', true).then((acc) => {
        setupUser('ga-thief-token').then(({ access_token: thiefToken }) => {
          cy.request({
            method: 'DELETE',
            url: `${BACKEND}/game-accounts/${acc.id}`,
            headers: { Authorization: `Bearer ${thiefToken}` },
            failOnStatusCode: false,
          }).then((res) => {
            expect(res.status).to.eq(403);
          });
        });
      });
    });
  });

  it("returns 403 when updating another user's account", () => {
    setupUser('ga-upd-owner-token').then(({ access_token }) => {
      cy.apiCreateGameAccount(access_token, 'OwnerOnly', true).then((acc) => {
        setupUser('ga-upd-thief-token').then(({ access_token: thiefToken }) => {
          cy.request({
            method: 'PUT',
            url: `${BACKEND}/game-accounts/${acc.id}`,
            headers: { Authorization: `Bearer ${thiefToken}` },
            body: { game_pseudo: 'Stolen', is_primary: true },
            failOnStatusCode: false,
          }).then((res) => {
            expect(res.status).to.eq(403);
          });
        });
      });
    });
  });

  it('returns 404 when getting a non-existent account', () => {
    setupUser('ga-404-token').then(({ access_token }) => {
      cy.request({
        method: 'GET',
        url: `${BACKEND}/game-accounts/00000000-0000-0000-0000-000000000000`,
        headers: { Authorization: `Bearer ${access_token}` },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(404);
      });
    });
  });

  it('returns 404 when deleting a non-existent account', () => {
    setupUser('ga-del404-token').then(({ access_token }) => {
      cy.request({
        method: 'DELETE',
        url: `${BACKEND}/game-accounts/00000000-0000-0000-0000-000000000000`,
        headers: { Authorization: `Bearer ${access_token}` },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(404);
      });
    });
  });

  it('cannot create more than 10 accounts', () => {
    setupUser('ga-limit-token').then(({ access_token }) => {
      for (let i = 0; i < 10; i++) {
        cy.apiCreateGameAccount(access_token, `Lim${i}`, i === 0);
      }
      cy.request({
        method: 'POST',
        url: `${BACKEND}/game-accounts`,
        headers: { Authorization: `Bearer ${access_token}` },
        body: { game_pseudo: 'TooMany', is_primary: false },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(400);
      });
    });
  });

  it('rejects updating pseudo to less than 2 chars (API)', () => {
    setupUser('ga-upd-short-token').then(({ access_token }) => {
      cy.apiCreateGameAccount(access_token, 'UpdTarget', true).then((acc) => {
        cy.request({
          method: 'PUT',
          url: `${BACKEND}/game-accounts/${acc.id}`,
          headers: { Authorization: `Bearer ${access_token}` },
          body: { game_pseudo: 'X', is_primary: true },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.eq(422);
        });
      });
    });
  });

  it('rejects updating pseudo to more than 16 chars (API)', () => {
    setupUser('ga-upd-long-token').then(({ access_token }) => {
      cy.apiCreateGameAccount(access_token, 'UpdTarget2', true).then((acc) => {
        cy.request({
          method: 'PUT',
          url: `${BACKEND}/game-accounts/${acc.id}`,
          headers: { Authorization: `Bearer ${access_token}` },
          body: { game_pseudo: 'A'.repeat(17), is_primary: true },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.eq(422);
        });
      });
    });
  });

  it('double-delete returns 404 on second attempt', () => {
    setupUser('ga-dbl-del-token').then(({ access_token }) => {
      cy.apiCreateGameAccount(access_token, 'DoubleDelete', true).then((acc) => {
        cy.request({
          method: 'DELETE',
          url: `${BACKEND}/game-accounts/${acc.id}`,
          headers: { Authorization: `Bearer ${access_token}` },
        }).then((res) => {
          expect(res.status).to.eq(204);
        });
        cy.request({
          method: 'DELETE',
          url: `${BACKEND}/game-accounts/${acc.id}`,
          headers: { Authorization: `Bearer ${access_token}` },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.eq(404);
        });
      });
    });
  });

  it('first account is always auto-promoted to primary', () => {
    setupUser('ga-autoprim-token').then(({ access_token }) => {
      cy.request({
        method: 'POST',
        url: `${BACKEND}/game-accounts`,
        headers: { Authorization: `Bearer ${access_token}` },
        body: { game_pseudo: 'AutoPrimary', is_primary: false },
      }).then((res) => {
        expect(res.status).to.eq(201);
        expect(res.body.is_primary).to.eq(true);
      });
    });
  });

  it('primary account is sorted first in the list', () => {
    setupUser('ga-sort-token').then(({ access_token }) => {
      cy.apiCreateGameAccount(access_token, 'Zebra', true);
      cy.apiCreateGameAccount(access_token, 'Alpha', false);

      cy.request({
        method: 'GET',
        url: `${BACKEND}/game-accounts`,
        headers: { Authorization: `Bearer ${access_token}` },
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body[0].game_pseudo).to.eq('Zebra');
        expect(res.body[0].is_primary).to.eq(true);
        expect(res.body[1].game_pseudo).to.eq('Alpha');
        expect(res.body[1].is_primary).to.eq(false);
      });
    });
  });
});
