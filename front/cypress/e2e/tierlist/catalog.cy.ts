import { BACKEND, setupTierList, visitTierListSignedOut } from '../../support/e2e';

/**
 * The public catalog behind the tier list: it answers without a token, carries
 * the saga roles of the season currently running, and leaves the champions
 * nobody can play out of the pool.
 *
 * Each test needs a catalog of its own — a season or none, playable or not — so
 * the champions are loaded per test rather than in the hook.
 */
describe('Tier list – the champion catalog', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  const publicCatalog = () => cy.request({ method: 'GET', url: `${BACKEND}/catalog/champions` });

  it('answers without a token', () => {
    setupTierList('tl-cat-public', [{ name: 'CatalogHero', championClass: 'Cosmic' }]);

    publicCatalog().then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.champions.map((champion: { name: string }) => champion.name)).to.include('CatalogHero');
    });
  });

  it('takes the saga roles from the season running now', () => {
    setupTierList('tl-cat-saga', [
      { name: 'SagaHero', championClass: 'Tech', saga: { is_saga_attacker: true } },
      { name: 'PlainHero', championClass: 'Skill' },
    ]);

    publicCatalog().then((res) => {
      assert.isNotNull(res.body.season_number);
      const champions = res.body.champions as Array<{ name: string; is_saga_attacker: boolean }>;
      expect(champions.find((c) => c.name === 'SagaHero')?.is_saga_attacker).to.eq(true);
      expect(champions.find((c) => c.name === 'PlainHero')?.is_saga_attacker).to.eq(false);
    });

    visitTierListSignedOut();
    cy.getByCy('tierlist-champion-SagaHero').find('[data-cy="saga-badge"]').should('exist');
    cy.getByCy('tierlist-champion-PlainHero').find('[data-cy="saga-badge"]').should('not.exist');
  });

  it('carries no saga role when no season is running', () => {
    setupTierList('tl-cat-noseason', [{ name: 'SeasonlessHero', championClass: 'Mystic' }]);

    publicCatalog().then((res) => {
      assert.isNull(res.body.season_number);
    });

    visitTierListSignedOut();
    cy.getByCy('tierlist-champion-SeasonlessHero').should('exist');
    cy.getByCy('tierlist-pool').find('[data-cy="saga-badge"]').should('not.exist');
  });

  it('leaves the champions nobody plays out of the pool', () => {
    setupTierList('tl-cat-unplayable', [
      { name: 'Doombot', championClass: 'Tech' },
      { name: 'Symbioid', championClass: 'Science' },
      { name: 'Sentinelbot', championClass: 'Tech' },
      { name: 'Anti-Venomoid', championClass: 'Science' },
      { name: 'RealHero', championClass: 'Cosmic' },
    ]);
    visitTierListSignedOut();

    cy.getByCy('tierlist-champion-RealHero').should('exist');
    cy.contains('1 of 1').should('be.visible');
    for (const name of ['Doombot', 'Symbioid', 'Sentinelbot', 'Anti-Venomoid']) {
      cy.getByCy(`tierlist-champion-${name}`).should('not.exist');
    }
  });

  it('says so when the catalog cannot be loaded', () => {
    cy.clearAllCookies();
    cy.clearAllLocalStorage();
    cy.intercept('GET', '**/api/back/catalog/champions', {
      statusCode: 500,
      body: { detail: 'Catalog down' },
    }).as('catalog');
    cy.visit('/tools');

    cy.wait('@catalog');
    cy.contains('The champion catalog could not be loaded.').should('be.visible');
    cy.getByCy('tierlist-pool').should('not.exist');
  });
});
