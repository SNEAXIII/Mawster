import { setupUser, BACKEND } from '../support/e2e';

describe('Game Accounts – UI', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Basic rendering
  // =========================================================================

  it('shows the game accounts section on the profile page', () => {
    setupUser('ga-section-token').then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo('profile');
      cy.contains('Game Accounts').should('be.visible');
    });
  });

  it('shows empty state when no accounts exist', () => {
    setupUser('ga-empty-token').then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo('profile');
      cy.contains('No game accounts yet').scrollIntoView().should('be.visible');
    });
  });

  // =========================================================================
  // Create
  // =========================================================================

  it('creates a game account via the profile form', () => {
    setupUser('ga-create-token').then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo('profile');

      cy.getByCy('account-pseudo-input').scrollIntoView().type('MyGamePseudo');
      cy.getByCy('account-create-btn').click();

      cy.contains('MyGamePseudo').scrollIntoView().should('be.visible');
      cy.contains('Game account created successfully').should('be.visible');
    });
  });

  it('shows the Primary badge on the first created account', () => {
    setupUser('ga-primary-token').then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo('profile');

      cy.getByCy('account-pseudo-input').scrollIntoView().type('PrimaryPlayer');
      cy.getByCy('account-create-btn').click();

      cy.contains('PrimaryPlayer').scrollIntoView().should('be.visible');
      cy.contains('Primary').should('be.visible');
    });
  });

  it('displays account count', () => {
    setupUser('ga-count-token').then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'Account1', true);
      cy.apiCreateGameAccount(access_token, 'Account2', false);

      cy.uiLogin(login);
      cy.navTo('profile');
      cy.contains('2/10 accounts').scrollIntoView().should('be.visible');
    });
  });

  // =========================================================================
  // Edit
  // =========================================================================

  it('edits a game account pseudo via the pencil icon', () => {
    setupUser('ga-edit-token').then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'OldPseudo', true);

      cy.uiLogin(login);
      cy.navTo('profile');
      cy.contains('OldPseudo').scrollIntoView().should('be.visible');

      cy.getByCy('account-row-OldPseudo')
        .find('[data-cy="account-edit-btn-0"]')
        .click({ force: true });

      cy.get('input[maxlength="16"]').clear().type('NewPseudo');
      cy.getByCy('account-edit-confirm').first().click({ force: true });

      cy.contains('Game account renamed successfully').should('be.visible');
      cy.contains('NewPseudo').scrollIntoView().should('be.visible');
    });
  });

  // =========================================================================
  // Delete
  // =========================================================================

  it('deletes a game account with confirmation dialog', () => {
    setupUser('ga-delete-token').then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'ToDelete', true);

      cy.uiLogin(login);
      cy.navTo('profile');
      cy.contains('ToDelete').scrollIntoView().should('be.visible');

      cy.getByCy('account-row-ToDelete')
        .find('[data-cy="account-delete-btn"]')
        .click({ force: true });

      cy.get('[role="alertdialog"]').should('be.visible');
      cy.get('[role="alertdialog"]').contains('button', 'Delete').click();

      cy.contains('Game account deleted successfully').should('be.visible');
      cy.contains('ToDelete').should('not.exist');
    });
  });

  // =========================================================================
  // Primary management
  // =========================================================================

  it('sets the primary account', () => {
    setupUser('ga-setprim-token').then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'Account1', true);
      cy.apiCreateGameAccount(access_token, 'Account2', false);

      cy.uiLogin(login);
      cy.navTo('profile');
      cy.getByCy('account-row-Account1')
        .scrollIntoView()
        .find('[data-cy="account-primary-badge"]')
        .should('exist');
      cy.getByCy('account-row-Account2')
        .scrollIntoView()
        .find('[data-cy="account-primary-badge"]')
        .should('not.exist');

      cy.getByCy('account-star-btn-1').click();

      cy.getByCy('account-row-Account2')
        .scrollIntoView()
        .find('[data-cy="account-primary-badge"]')
        .should('exist');
      cy.getByCy('account-row-Account1')
        .scrollIntoView()
        .find('[data-cy="account-primary-badge"]')
        .should('not.exist');
    });
  });

  it('create new account does not steal primary from the first', () => {
    setupUser('ga-newprim-token').then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'MainAccount', true);

      cy.uiLogin(login);
      cy.navTo('profile');

      cy.getByCy('collapsible-add-a-game-account').scrollIntoView().click();
      cy.getByCy('account-pseudo-input').scrollIntoView().type('SecondAccount');
      cy.getByCy('account-create-btn').click();

      cy.contains('SecondAccount').scrollIntoView().should('be.visible');

      cy.getByCy('account-row-MainAccount')
        .scrollIntoView()
        .find('[data-cy="account-primary-badge"]')
        .should('exist');
      cy.getByCy('account-row-SecondAccount')
        .scrollIntoView()
        .find('[data-cy="account-primary-badge"]')
        .should('not.exist');

      // Switch primary to SecondAccount
      cy.getByCy('account-star-btn-1').click();

      cy.getByCy('account-row-SecondAccount')
        .scrollIntoView()
        .find('[data-cy="account-primary-badge"]')
        .should('exist');
      cy.getByCy('account-row-MainAccount')
        .scrollIntoView()
        .find('[data-cy="account-primary-badge"]')
        .should('not.exist');
    });
  });

  // =========================================================================
  // Edge cases — pseudo length validation (2–16 chars)
  // =========================================================================

  it('rejects a pseudo shorter than 2 characters (API)', () => {
    setupUser('ga-short-token').then(({ access_token }) => {
      cy.request({
        method: 'POST',
        url: `${BACKEND}/game-accounts`,
        headers: { Authorization: `Bearer ${access_token}` },
        body: { game_pseudo: 'A', is_primary: true },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(422);
      });
    });
  });

  it('rejects an empty pseudo (API)', () => {
    setupUser('ga-empty-pseudo-token').then(({ access_token }) => {
      cy.request({
        method: 'POST',
        url: `${BACKEND}/game-accounts`,
        headers: { Authorization: `Bearer ${access_token}` },
        body: { game_pseudo: '', is_primary: true },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(422);
      });
    });
  });

  it('accepts a pseudo of exactly 2 characters (API)', () => {
    setupUser('ga-min2-token').then(({ access_token }) => {
      cy.request({
        method: 'POST',
        url: `${BACKEND}/game-accounts`,
        headers: { Authorization: `Bearer ${access_token}` },
        body: { game_pseudo: 'AB', is_primary: true },
      }).then((res) => {
        expect(res.status).to.eq(201);
        expect(res.body.game_pseudo).to.eq('AB');
      });
    });
  });

  it('accepts a pseudo of exactly 16 characters (API)', () => {
    setupUser('ga-max16-token').then(({ access_token }) => {
      const pseudo16 = 'A'.repeat(16);
      cy.request({
        method: 'POST',
        url: `${BACKEND}/game-accounts`,
        headers: { Authorization: `Bearer ${access_token}` },
        body: { game_pseudo: pseudo16, is_primary: true },
      }).then((res) => {
        expect(res.status).to.eq(201);
        expect(res.body.game_pseudo).to.eq(pseudo16);
      });
    });
  });

  it('rejects a pseudo longer than 16 characters (API)', () => {
    setupUser('ga-toolong-token').then(({ access_token }) => {
      const pseudo17 = 'A'.repeat(17);
      cy.request({
        method: 'POST',
        url: `${BACKEND}/game-accounts`,
        headers: { Authorization: `Bearer ${access_token}` },
        body: { game_pseudo: pseudo17, is_primary: true },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(422);
      });
    });
  });

  // =========================================================================
  // Edge cases — ownership & auth
  // =========================================================================

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

  // =========================================================================
  // Edge cases — 404 & limits
  // =========================================================================

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

  // =========================================================================
  // Edge cases — update validation
  // =========================================================================

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
      // Create with is_primary=false, should still become primary
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
