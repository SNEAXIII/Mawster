import { setupRosterUser } from '../../support/e2e';

/**
 * The board a visitor built before signing in. Signing in never migrates it
 * silently: the page offers to bring it over, and either answer settles it.
 */
describe('Tier list – the browser board on sign in', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  /**
   * Sign in without wiping the browser — `cy.apiLogin` clears local storage,
   * which is exactly the board this dialog exists for.
   */
  const signInKeepingStorage = (userId: string) => {
    cy.request('POST', '/api/dev/login', { user_id: userId }).then((res) => {
      cy.setCookie('authjs.session-token', res.body.sessionToken);
    });
    cy.visit('/tools');
  };

  const buildLocalBoard = (prefix: string, name: string) =>
    setupRosterUser(prefix, `${prefix}-player`).then((users) => {
      cy.apiLoadChampion(users.adminData.access_token, name, 'Cosmic');
      cy.clearAllCookies();
      cy.clearAllSessionStorage();
      cy.clearAllLocalStorage();
      cy.visit('/tools');

      cy.getByCy(`tierlist-champion-${name}`).click();
      cy.getByCy('tierlist-send-to-S').click();
      cy.get('body').type('{esc}');
      cy.window().its('localStorage').invoke('getItem', 'mawster-tierlist:board').should('not.be.null');

      return cy.wrap(users);
    });

  it('offers the browser board once signed in', () => {
    buildLocalBoard('tl-local-offer', 'LocalHero').then(({ userData }) => {
      signInKeepingStorage(userData.user_id);

      cy.getByCy('tierlist-import-local-dialog').should('be.visible');
      cy.getByCy('tierlist-import-local-dialog').should('contain', '1');
    });
  });

  it('imports it into the open list and forgets the browser copy', () => {
    buildLocalBoard('tl-local-import', 'ImportHero').then(({ userData }) => {
      cy.intercept('POST', '**/api/back/tierlists').as('createList');
      signInKeepingStorage(userData.user_id);

      cy.getByCy('tierlist-import-local-confirm').click();

      cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-ImportHero"]').should('exist');
      cy.getByCy('tierlist-import-local-dialog').should('not.exist');
      cy.window().its('localStorage').invoke('getItem', 'mawster-tierlist:board').should('be.null');
      cy.wait('@createList').its('response.statusCode').should('eq', 201);
    });
  });

  it('discards it without touching the account board', () => {
    buildLocalBoard('tl-local-discard', 'DiscardHero').then(({ userData }) => {
      signInKeepingStorage(userData.user_id);

      cy.getByCy('tierlist-import-local-discard').click();

      cy.getByCy('tierlist-import-local-dialog').should('not.exist');
      cy.getByCy('tierlist-row-S').should('contain', 'Drop champions here');
      cy.getByCy('tierlist-pool').find('[data-cy="tierlist-champion-DiscardHero"]').should('exist');
      cy.window().its('localStorage').invoke('getItem', 'mawster-tierlist:board').should('be.null');
    });
  });

  it('does not ask again once the question is answered', () => {
    buildLocalBoard('tl-local-once', 'OnceHero').then(({ userData }) => {
      signInKeepingStorage(userData.user_id);

      cy.getByCy('tierlist-import-local-discard').click();
      cy.getByCy('tierlist-import-local-dialog').should('not.exist');

      cy.reload();
      cy.getByCy('tierlist-pool').should('exist');
      cy.getByCy('tierlist-import-local-dialog').should('not.exist');
    });
  });

  it('says nothing when the browser holds no board', () => {
    setupRosterUser('tl-local-none', 'NoLocalPlayer').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'FreshHero', 'Mystic');
      cy.apiLogin(userData.user_id, '/tools');

      cy.getByCy('tierlist-pool').should('exist');
      cy.getByCy('tierlist-import-local-dialog').should('not.exist');
    });
  });
});
