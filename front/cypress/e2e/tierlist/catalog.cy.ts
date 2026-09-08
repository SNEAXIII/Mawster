import { BACKEND, setupRosterUser } from '../../support/e2e';

/**
 * The public catalog behind the tier list: it answers without a token, carries
 * the saga roles of the season currently running, and leaves the champions
 * nobody can play out of the pool.
 */
describe('Tier list – the champion catalog', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('answers without a token', () => {
    setupRosterUser('tl-catalog-public', 'CatalogPlayer').then(({ adminData }) => {
      cy.apiLoadChampion(adminData.access_token, 'CatalogHero', 'Cosmic');

      cy.request({ method: 'GET', url: `${BACKEND}/catalog/champions` }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.champions.map((champion: { name: string }) => champion.name)).to.include('CatalogHero');
      });
    });
  });

  it('takes the saga roles from the season running now', () => {
    setupRosterUser('tl-catalog-saga', 'SagaPlayer').then(({ adminData }) => {
      const token = adminData.access_token;
      cy.apiLoadChampionWithSaga(token, 'SagaHero', 'Tech', { is_saga_attacker: true });
      cy.apiLoadChampion(token, 'PlainHero', 'Skill');

      cy.request({ method: 'GET', url: `${BACKEND}/catalog/champions` }).then((res) => {
        expect(res.body.season_number).to.not.eq(null);
        const champions = res.body.champions as Array<{ name: string; is_saga_attacker: boolean }>;
        expect(champions.find((c) => c.name === 'SagaHero')?.is_saga_attacker).to.eq(true);
        expect(champions.find((c) => c.name === 'PlainHero')?.is_saga_attacker).to.eq(false);
      });

      cy.clearAllCookies();
      cy.clearAllLocalStorage();
      cy.visit('/tools');
      cy.getByCy('tierlist-champion-SagaHero').find('[data-cy="saga-badge"]').should('exist');
      cy.getByCy('tierlist-champion-PlainHero').find('[data-cy="saga-badge"]').should('not.exist');
    });
  });

  it('carries no saga role when no season is running', () => {
    setupRosterUser('tl-catalog-noseason', 'NoSeasonPlayer').then(({ adminData }) => {
      cy.apiLoadChampion(adminData.access_token, 'SeasonlessHero', 'Mystic');

      cy.request({ method: 'GET', url: `${BACKEND}/catalog/champions` }).then((res) => {
        expect(res.body.season_number).to.eq(null);
      });

      cy.clearAllCookies();
      cy.clearAllLocalStorage();
      cy.visit('/tools');
      cy.getByCy('tierlist-champion-SeasonlessHero').should('exist');
      cy.getByCy('tierlist-pool').find('[data-cy="saga-badge"]').should('not.exist');
    });
  });

  it('leaves the champions nobody plays out of the pool', () => {
    setupRosterUser('tl-catalog-unplayable', 'UnplayablePlayer').then(({ adminData }) => {
      const token = adminData.access_token;
      cy.apiLoadChampion(token, 'Doombot', 'Tech');
      cy.apiLoadChampion(token, 'Symbioid', 'Science');
      cy.apiLoadChampion(token, 'Sentinelbot', 'Tech');
      cy.apiLoadChampion(token, 'Anti-Venomoid', 'Science');
      cy.apiLoadChampion(token, 'RealHero', 'Cosmic');
      cy.clearAllCookies();
      cy.clearAllLocalStorage();
      cy.visit('/tools');

      cy.getByCy('tierlist-champion-RealHero').should('exist');
      cy.contains('1 of 1').should('be.visible');
      for (const name of ['Doombot', 'Symbioid', 'Sentinelbot', 'Anti-Venomoid']) {
        cy.getByCy(`tierlist-champion-${name}`).should('not.exist');
      }
    });
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
