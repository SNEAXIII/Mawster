import { setupRosterUser } from '../../support/e2e';

/**
 * The tier list signed out: it has to answer without a session, and whatever the
 * visitor ranks stays in their browser.
 */
describe('Tier list – signed out', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  /** Loads a small catalog with an admin, then drops the session entirely. */
  const visitAnonymously = (prefix: string, path = '/tools') => {
    setupRosterUser(prefix, `${prefix}-player`).then(({ adminData }) => {
      cy.apiLoadChampion(adminData.access_token, 'PublicOne', 'Cosmic');
      cy.apiLoadChampion(adminData.access_token, 'PublicTwo', 'Mystic');
      cy.clearAllCookies();
      cy.clearAllSessionStorage();
      cy.clearAllLocalStorage();
      cy.visit(path);
    });
  };

  it('serves /tools without a session, on the tier list', () => {
    visitAnonymously('tl-pub-open');

    cy.getByCy('tab-tierlist').should('be.visible');
    cy.getByCy('tierlist-title').should('exist');
    cy.getByCy('tierlist-pool').should('exist');
  });

  it('opens the tier list from a ?tab=tierlist link', () => {
    visitAnonymously('tl-pub-link', '/tools?tab=tierlist');

    cy.url().should('include', '/tools?tab=tierlist');
    cy.getByCy('tierlist-pool').should('exist');
  });

  it('loads the catalog and counts what it shows', () => {
    visitAnonymously('tl-pub-catalog');

    cy.getByCy('tierlist-champion-PublicOne').should('be.visible');
    cy.getByCy('tierlist-champion-PublicTwo').should('be.visible');
    cy.contains('2 of 2').should('be.visible');
  });

  it('says the tier list stays in this browser', () => {
    visitAnonymously('tl-pub-notice');

    cy.contains('You are not signed in: this tier list stays in this browser.').should('be.visible');
  });

  it('offers neither the list picker nor the create button', () => {
    visitAnonymously('tl-pub-nopicker');

    cy.getByCy('tierlist-pool').should('exist');
    cy.getByCy('tierlist-picker').should('not.exist');
    cy.getByCy('tierlist-create').should('not.exist');
    cy.getByCy('tierlist-delete').should('not.exist');
  });

  it('starts on five empty rows, S to D', () => {
    visitAnonymously('tl-pub-rows');

    for (const label of ['S', 'A', 'B', 'C', 'D']) {
      cy.getByCy(`tierlist-row-${label}`).should('contain', 'Drop champions here');
    }
    cy.getByCy('tierlist-row-E').should('not.exist');
  });

  it('keeps a ranked champion across a reload', () => {
    visitAnonymously('tl-pub-persist');

    cy.getByCy('tierlist-champion-PublicOne').click();
    cy.getByCy('tierlist-send-to-S').click();
    cy.get('body').type('{esc}');

    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-PublicOne"]').should('exist');
    // The board is written a second after the last change — waiting on the
    // stored value is what makes the reload deterministic.
    cy.window().its('localStorage').invoke('getItem', 'mawster-tierlist:board').should('not.be.null');

    cy.reload();

    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-PublicOne"]').should('exist');
    cy.getByCy('tierlist-pool').find('[data-cy="tierlist-champion-PublicOne"]').should('not.exist');
  });

  it('shows the Tools entry in the nav without a session', () => {
    visitAnonymously('tl-pub-nav', '/');

    cy.getByCy('nav-tools').should('be.visible').click();
    cy.url().should('include', '/tools');
    cy.getByCy('tierlist-pool').should('exist');
  });
});
