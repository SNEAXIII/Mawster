import { setupRosterUser } from '../../support/e2e';

/**
 * The filters. They narrow the rows as well as the pool, so a filtered board
 * shows what it is hiding rather than looking empty.
 *
 * `is_7_star` is false for every champion the loader creates, so "7★ only" is
 * expected to show nothing and "6★ only" the whole catalog — that is the data,
 * not a bug in the filter.
 */
describe('Tier list – filters', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  const visitWithCatalog = (prefix: string) => {
    setupRosterUser(prefix, `${prefix}-player`).then(({ adminData }) => {
      const token = adminData.access_token;
      cy.apiLoadChampion(token, 'AlphaHero', 'Cosmic', { alias: 'Ægon Twin' });
      cy.apiLoadChampion(token, 'BetaHero', 'Mystic', { is_ascendable: true });
      cy.apiLoadChampionWithSaga(token, 'GammaHero', 'Tech', { is_saga_attacker: true });
      cy.apiLoadChampionWithSaga(token, 'DeltaHero', 'Skill', { is_saga_defender: true });
      cy.clearAllCookies();
      cy.clearAllSessionStorage();
      cy.clearAllLocalStorage();
      cy.visit('/tools');
      cy.contains('4 of 4').should('be.visible');
    });
  };

  const onlyInPool = (name: string) => {
    cy.getByCy('tierlist-pool').find(`[data-cy="tierlist-champion-${name}"]`).should('exist');
    cy.getByCy('tierlist-pool').find('[data-cy^="tierlist-champion-"]').should('have.length', 1);
  };

  const rank = (name: string, label: string) => {
    cy.getByCy(`tierlist-champion-${name}`).first().click();
    cy.getByCy(`tierlist-send-to-${label}`).click();
    cy.get('body').type('{esc}');
  };

  it('searches by name', () => {
    visitWithCatalog('tl-filters-name');

    cy.getByCy('tierlist-search').type('alpha');
    onlyInPool('AlphaHero');
    cy.contains('1 of 4').should('be.visible');
  });

  it('searches by alias, accents folded', () => {
    visitWithCatalog('tl-filters-alias');

    cy.getByCy('tierlist-search').type('aegon');
    onlyInPool('AlphaHero');
  });

  it('filters by class, one class at a time', () => {
    visitWithCatalog('tl-filters-class');

    cy.selectOption('selector-class-filter', 'Cosmic');
    onlyInPool('AlphaHero');

    cy.selectOption('selector-class-filter', 'Mystic');
    onlyInPool('BetaHero');
  });

  it('filters by rarity — nothing is a 7★ yet, so 6★ is everything', () => {
    visitWithCatalog('tl-filters-rarity');

    cy.selectOption('tierlist-rarity-filter', '7★ only');
    cy.getByCy('tierlist-pool').should('contain', 'No champion matches these filters.');
    cy.contains('0 of 4').should('be.visible');

    cy.selectOption('tierlist-rarity-filter', '6★ only');
    cy.contains('4 of 4').should('be.visible');

    cy.selectOption('tierlist-rarity-filter', 'Every rarity');
    cy.contains('4 of 4').should('be.visible');
  });

  it('filters the ascendable champions', () => {
    visitWithCatalog('tl-filters-ascendable');

    cy.getByCy('selector-toggle-ascendable').click();
    onlyInPool('BetaHero');
  });

  it('filters the saga attackers', () => {
    visitWithCatalog('tl-filters-saga-atk');

    cy.getByCy('selector-toggle-saga-attacker').click();
    onlyInPool('GammaHero');
  });

  it('filters the saga defenders', () => {
    visitWithCatalog('tl-filters-saga-def');

    cy.getByCy('selector-toggle-saga-defender').click();
    onlyInPool('DeltaHero');
  });

  it('takes several tags as an AND, not an OR', () => {
    visitWithCatalog('tl-filters-tags');

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
    visitWithCatalog('tl-filters-rows');

    rank('AlphaHero', 'S');
    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-AlphaHero"]').should('exist');

    cy.selectOption('selector-class-filter', 'Mystic');
    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-AlphaHero"]').should('not.exist');
    cy.getByCy('tierlist-row-S').should('contain', '1 hidden by the filters');
  });

  it('resets every filter, rarity included', () => {
    visitWithCatalog('tl-filters-reset');

    cy.getByCy('tierlist-search').type('alpha');
    cy.selectOption('tierlist-rarity-filter', '7★ only');
    cy.getByCy('selector-toggle-ascendable').click();
    cy.contains('0 of 4').should('be.visible');

    cy.getByCy('selector-reset-filters').click();

    cy.contains('4 of 4').should('be.visible');
    cy.getByCy('tierlist-search').should('have.value', '');
    cy.getByCy('tierlist-rarity-filter').should('contain', 'Every rarity');
    cy.getByCy('selector-reset-filters').should('not.exist');
  });
});
