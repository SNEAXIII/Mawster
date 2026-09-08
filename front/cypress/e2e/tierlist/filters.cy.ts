import { rankChampion, setupTierList, visitTierListSignedOut } from '../../support/e2e';

/**
 * The filters. They narrow the rows as well as the pool, so a filtered board
 * shows what it is hiding rather than looking empty.
 */
describe('Tier list – filters', () => {
  const CATALOG = [
    { name: 'AlphaHero', championClass: 'Cosmic', options: { alias: 'Ægon Twin' } },
    { name: 'BetaHero', championClass: 'Mystic', options: { is_ascendable: true } },
    { name: 'GammaHero', championClass: 'Tech', saga: { is_saga_attacker: true } },
    { name: 'DeltaHero', championClass: 'Skill', saga: { is_saga_defender: true } },
  ];

  beforeEach(() => {
    cy.truncateDb();
    setupTierList('tl-filters', CATALOG);
    visitTierListSignedOut();
    cy.contains('4 of 4').should('be.visible');
  });

  const onlyInPool = (name: string) => {
    cy.getByCy('tierlist-pool').find(`[data-cy="tierlist-champion-${name}"]`).should('exist');
    cy.getByCy('tierlist-pool').find('[data-cy^="tierlist-champion-"]').should('have.length', 1);
  };

  it('searches by name', () => {
    cy.getByCy('tierlist-search').type('alpha');

    onlyInPool('AlphaHero');
    cy.contains('1 of 4').should('be.visible');
  });

  it('searches by alias, accents folded', () => {
    cy.getByCy('tierlist-search').type('aegon');

    onlyInPool('AlphaHero');
  });

  it('filters by class, one class at a time', () => {
    cy.selectOption('selector-class-filter', 'Cosmic');
    onlyInPool('AlphaHero');

    cy.selectOption('selector-class-filter', 'Mystic');
    onlyInPool('BetaHero');
  });

  /**
   * SKIPPED until the `is_7_stars_available` lot lands.
   *
   * `load_champions` forces `is_7_star` to false and no admin toggle sets it, so
   * today "7★ only" shows nothing and "6★ only" shows the whole catalog — the
   * filter would pass on data that says nothing. Once a champion can be flagged
   * 7★: flag one in the catalog above, then expect "7★ only" to show that one
   * and "6★ only" to show the other three.
   */
  it.skip('filters by rarity', () => {
    cy.selectOption('tierlist-rarity-filter', '7★ only');
    cy.contains('1 of 4').should('be.visible');
    onlyInPool('AlphaHero');

    cy.selectOption('tierlist-rarity-filter', '6★ only');
    cy.contains('3 of 4').should('be.visible');

    cy.selectOption('tierlist-rarity-filter', 'Every rarity');
    cy.contains('4 of 4').should('be.visible');
  });

  it('filters the ascendable champions', () => {
    cy.getByCy('selector-toggle-ascendable').click();

    onlyInPool('BetaHero');
  });

  it('filters the saga attackers', () => {
    cy.getByCy('selector-toggle-saga-attacker').click();

    onlyInPool('GammaHero');
  });

  it('filters the saga defenders', () => {
    cy.getByCy('selector-toggle-saga-defender').click();

    onlyInPool('DeltaHero');
  });

  it('takes several tags as an AND, not an OR', () => {
    cy.getByCy('tierlist-champion-AlphaHero').click();
    cy.getByCy('tierlist-tag-is_attacker').click();
    cy.getByCy('tierlist-tag-is_defender').click();
    cy.get('body').type('{esc}');

    cy.getByCy('tierlist-champion-BetaHero').click();
    cy.getByCy('tierlist-tag-is_attacker').click();
    cy.get('body').type('{esc}');

    cy.getByCy('tierlist-filter-tag-is_attacker').click();
    cy.contains('2 of 4').should('be.visible');

    cy.getByCy('tierlist-filter-tag-is_defender').click();
    cy.contains('1 of 4').should('be.visible');
    onlyInPool('AlphaHero');
  });

  it('narrows the rows too, and says how many it hides', () => {
    rankChampion('AlphaHero', 'S');
    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-AlphaHero"]').should('exist');

    cy.selectOption('selector-class-filter', 'Mystic');

    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-AlphaHero"]').should('not.exist');
    cy.getByCy('tierlist-row-S').should('contain', '1 hidden by the filters');
  });

  it('resets every filter, rarity included', () => {
    cy.getByCy('tierlist-search').type('alpha');
    // A rarity other than the default, to prove the reset takes it back too.
    cy.selectOption('tierlist-rarity-filter', '6★ only');
    // AlphaHero is not ascendable, so the two together leave nothing.
    cy.getByCy('selector-toggle-ascendable').click();
    cy.contains('0 of 4').should('be.visible');

    cy.getByCy('selector-reset-filters').click();

    cy.contains('4 of 4').should('be.visible');
    cy.getByCy('tierlist-search').should('have.value', '');
    cy.getByCy('tierlist-rarity-filter').should('contain', 'Every rarity');
    cy.getByCy('selector-reset-filters').should('not.exist');
  });
});
