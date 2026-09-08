import {
  rankChampion,
  setupTierList,
  storedBoard,
  visitTierListSignedOut,
  type TierListSetup,
} from '../../support/e2e';

/**
 * The board a visitor built before signing in. Signing in never migrates it
 * silently: the page offers to bring it over, and either answer settles it.
 */
describe('Tier list – the browser board on sign in', () => {
  const CATALOG = [{ name: 'LocalHero', championClass: 'Cosmic' }];

  let setup: TierListSetup;

  beforeEach(() => {
    cy.truncateDb();
    setupTierList('tl-local', CATALOG).then((result) => {
      setup = result;
    });
    // Every test here starts from a board built with no session.
    visitTierListSignedOut();
    rankChampion('LocalHero', 'S');
    storedBoard().should('not.be.null');
  });

  /**
   * Sign in without wiping the browser — `cy.apiLogin` clears local storage,
   * which is exactly the board this dialog exists for.
   */
  const signInKeepingStorage = () => {
    cy.request('POST', '/api/dev/login', { user_id: setup.userData.user_id }).then((res) => {
      cy.setCookie('authjs.session-token', res.body.sessionToken);
    });
    cy.visit('/tools');
  };

  it('offers the browser board once signed in', () => {
    signInKeepingStorage();

    cy.getByCy('tierlist-import-local-dialog').should('be.visible');
    cy.getByCy('tierlist-import-local-dialog').should('contain', '1');
  });

  it('imports it into the open list and forgets the browser copy', () => {
    cy.intercept('POST', '**/api/back/tierlists').as('createList');
    signInKeepingStorage();

    cy.getByCy('tierlist-import-local-confirm').click();

    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-LocalHero"]').should('exist');
    cy.getByCy('tierlist-import-local-dialog').should('not.exist');
    storedBoard().should('be.null');
    cy.wait('@createList').its('response.statusCode').should('eq', 201);
  });

  it('discards it without touching the account board', () => {
    signInKeepingStorage();

    cy.getByCy('tierlist-import-local-discard').click();

    cy.getByCy('tierlist-import-local-dialog').should('not.exist');
    cy.getByCy('tierlist-row-S').should('contain', 'Drop champions here');
    cy.getByCy('tierlist-pool').find('[data-cy="tierlist-champion-LocalHero"]').should('exist');
    storedBoard().should('be.null');
  });

  it('does not ask again once the question is answered', () => {
    signInKeepingStorage();

    cy.getByCy('tierlist-import-local-discard').click();
    cy.getByCy('tierlist-import-local-dialog').should('not.exist');

    cy.reload();

    cy.getByCy('tierlist-pool').should('exist');
    cy.getByCy('tierlist-import-local-dialog').should('not.exist');
  });

  it('says nothing when the browser holds no board', () => {
    cy.clearAllLocalStorage();
    signInKeepingStorage();

    cy.getByCy('tierlist-pool').should('exist');
    cy.getByCy('tierlist-import-local-dialog').should('not.exist');
  });
});
