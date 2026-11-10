import {
  rankChampion,
  setupTierList,
  storedBoard,
  visitTierListSignedOut,
  type TierListSetup,
} from '../../support/e2e';

/** How the board is kept: in this browser, on every change, and only when something moved. */
describe('Tier list – saving', () => {
  const CATALOG = [{ name: 'SaveHero', championClass: 'Cosmic' }];

  let setup: TierListSetup;

  beforeEach(() => {
    cy.truncateDb();
    setupTierList('tl-save', CATALOG).then((result) => {
      setup = result;
    });
  });

  it('keeps a change across a reload', () => {
    visitTierListSignedOut();

    rankChampion('SaveHero', 'S');
    storedBoard().should('contain', setup.championIds.SaveHero);

    cy.reload();
    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-SaveHero"]').should('exist');
  });

  it('writes nothing when nothing moved', () => {
    visitTierListSignedOut();

    // The sheet first: the ascendable filter below empties the pool, and
    // SaveHero would no longer be there to open.
    cy.getByCy('tierlist-champion-SaveHero').click();
    cy.get('body').type('{esc}');
    cy.getByCy('tierlist-search').type('save');
    cy.getByCy('selector-toggle-ascendable').click();
    cy.getByCy('tierlist-pool').scrollIntoView();

    storedBoard().should('be.null');
  });

  it('never sends the board to the backend', () => {
    cy.intercept('**/api/back/tierlists*').as('tierlists');
    visitTierListSignedOut();

    rankChampion('SaveHero', 'S');
    storedBoard().should('not.be.null');

    cy.get('@tierlists.all').should('have.length', 0);
  });

  it('adopts the single board a browser kept before lists, once', () => {
    cy.clearAllLocalStorage();
    cy.visit('/tools', {
      onBeforeLoad: (win) =>
        win.localStorage.setItem(
          'mawster-tierlist:board',
          JSON.stringify({
            id: null,
            title: 'Legacy',
            tiers: [{ id: 'tier-s', label: 'S', color: '#ff7f7f', championIds: [setup.championIds.SaveHero] }],
            tags: {},
          }),
        ),
    });

    cy.getByCy('tierlist-title').should('have.value', 'Legacy');
    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-SaveHero"]').should('exist');
    cy.window().its('localStorage').invoke('getItem', 'mawster-tierlist:board').should('be.null');
  });
});
