import {
  rankChampion,
  seedTierList,
  setupTierList,
  storedBoard,
  visitTierListAs,
  visitTierListSignedOut,
  type TierListSetup,
} from '../../support/e2e';

/**
 * How the board is written back: a second after the last gesture, whole, and
 * only when something actually moved. Signed out it never leaves the browser.
 */
describe('Tier list – saving', () => {
  const CATALOG = [{ name: 'SaveHero', championClass: 'Cosmic' }];

  let setup: TierListSetup;

  beforeEach(() => {
    cy.truncateDb();
    setupTierList('tl-save', CATALOG).then((result) => {
      setup = result;
    });
  });

  /** A list to save into, plus the PUT alias every test here waits on. */
  const signInOnList = () => {
    seedTierList(setup.userData.access_token, 'Alpha');
    cy.intercept('PUT', '**/api/back/tierlists/*').as('save');
    visitTierListAs(setup.userData.user_id);
  };

  it('sends one PUT a second after the change', () => {
    signInOnList();

    rankChampion('SaveHero', 'S');

    cy.wait('@save').its('response.statusCode').should('eq', 200);
    cy.get('@save.all').should('have.length', 1);
  });

  it('folds gestures made in a row into a single PUT', () => {
    signInOnList();

    // Keystrokes rather than clicks: the suite types with no delay, so six
    // board changes land within milliseconds and cannot straddle the save
    // delay — three clicks on a loaded runner can, and then it is two PUTs.
    cy.getByCy('tierlist-title').clear().type('Folded');

    cy.wait('@save');
    cy.get('@save.all').should('have.length', 1);
    // The one payload carries the whole word, not the letter it started with.
    cy.get('@save.all').its('0.request.body.title').should('eq', 'Folded');
  });

  it('sends nothing when nothing moved', () => {
    signInOnList();

    // The sheet first: the ascendable filter below empties the pool, and
    // SaveHero would no longer be there to open.
    cy.getByCy('tierlist-champion-SaveHero').click();
    cy.get('body').type('{esc}');
    cy.getByCy('tierlist-search').type('save');
    cy.getByCy('selector-toggle-ascendable').click();
    cy.getByCy('tierlist-pool').scrollIntoView();

    // An absence cannot be waited for, so it is pinned to something that can:
    // one real change, and the PUT it triggers. That PUT has to be the first
    // one — it carries the sixth row — which is only true if none of the
    // gestures above sent anything.
    cy.getByCy('tierlist-add-row').click();

    cy.wait('@save').its('request.body.tiers').should('have.length', 6);
    cy.get('@save.all').should('have.length', 1);
  });

  it('goes through Saving… on the way to Saved', () => {
    seedTierList(setup.userData.access_token, 'Alpha');
    cy.intercept('PUT', '**/api/back/tierlists/*', (req) => {
      req.continue((res) => {
        res.setDelay(1500);
      });
    }).as('save');
    visitTierListAs(setup.userData.user_id);

    cy.getByCy('tierlist-save-state').should('contain', 'Saved');
    rankChampion('SaveHero', 'S');

    cy.getByCy('tierlist-save-state').should('contain', 'Saving');
    cy.wait('@save');
    cy.getByCy('tierlist-save-state').should('contain', 'Saved');
  });

  it('shows a failed save without losing the board', () => {
    seedTierList(setup.userData.access_token, 'Alpha');
    cy.intercept('PUT', '**/api/back/tierlists/*', {
      statusCode: 500,
      body: { detail: 'Save refused' },
    }).as('save');
    visitTierListAs(setup.userData.user_id);

    rankChampion('SaveHero', 'S');

    cy.wait('@save');
    cy.getByCy('tierlist-save-state').should('contain', 'Save refused');
    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-SaveHero"]').should('exist');
  });

  it('keeps a signed-out board off the network', () => {
    cy.intercept('POST', '**/api/back/tierlists').as('create');
    cy.intercept('PUT', '**/api/back/tierlists/*').as('save');
    visitTierListSignedOut();

    rankChampion('SaveHero', 'S');

    // The browser write and the request are the same branch of the same timer:
    // once the board is in local storage, the save has run, and whatever it was
    // going to send it has sent.
    storedBoard().should('not.be.null');
    cy.get('@create.all').should('have.length', 0);
    cy.get('@save.all').should('have.length', 0);
  });
});
