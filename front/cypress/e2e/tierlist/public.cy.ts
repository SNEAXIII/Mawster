import { rankChampion, setupTierList, storedBoard, visitTierListSignedOut } from '../../support/e2e';

/**
 * The tier list signed out: it has to answer without a session, and whatever the
 * visitor ranks stays in their browser.
 */
describe('Tier list – signed out', () => {
  const CATALOG = [
    { name: 'PublicOne', championClass: 'Cosmic' },
    { name: 'PublicTwo', championClass: 'Mystic' },
  ];

  beforeEach(() => {
    cy.truncateDb();
    setupTierList('tl-public', CATALOG);
    visitTierListSignedOut();
  });

  it('serves /tools without a session, on the tier list', () => {
    cy.getByCy('tab-tierlist').should('be.visible');
    cy.getByCy('tierlist-title').should('exist');
  });

  it('writes the open tab into the URL', () => {
    cy.url().should('include', '/tools?tab=tierlist');

    // And a link that already names the tab is left as it is.
    cy.visit('/tools?tab=tierlist');
    cy.getByCy('tierlist-pool').should('exist');
    cy.url().should('include', '/tools?tab=tierlist');
  });

  it('loads the catalog and counts what it shows', () => {
    cy.getByCy('tierlist-champion-PublicOne').should('be.visible');
    cy.getByCy('tierlist-champion-PublicTwo').should('be.visible');
    cy.contains('2 of 2').should('be.visible');
  });

  it('says the tier lists stay in this browser', () => {
    cy.contains('Your tier lists are kept in this browser only').should('be.visible');
  });

  it('offers the create button without a session', () => {
    cy.getByCy('tierlist-create').should('be.visible');
  });

  it('starts on five empty rows, S to D', () => {
    for (const label of ['S', 'A', 'B', 'C', 'D']) {
      cy.getByCy(`tierlist-row-${label}`).should('contain', 'Drop champions here');
    }
    cy.getByCy('tierlist-row-E').should('not.exist');
  });

  it('keeps a ranked champion across a reload', () => {
    rankChampion('PublicOne', 'S');

    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-PublicOne"]').should('exist');
    storedBoard().should('not.be.null');

    cy.reload();

    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-PublicOne"]').should('exist');
    cy.getByCy('tierlist-pool').find('[data-cy="tierlist-champion-PublicOne"]').should('not.exist');
  });

  it('shows the Tools entry in the nav without a session', () => {
    cy.visit('/');
    cy.getByCy('nav-tools').should('be.visible').click();
    cy.url().should('include', '/tools');
    cy.getByCy('tierlist-pool').should('exist');
  });
});
