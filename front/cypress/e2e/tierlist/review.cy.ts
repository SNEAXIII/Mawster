import { setupRosterUser } from '../../support/e2e';

/**
 * Review mode: one champion at a time, a row picked with a key or a click. It is
 * also the other way a spec can rank a champion, dragging not being scriptable.
 *
 * The catalog comes back ordered by name, so the run walks RevAlpha, RevBravo,
 * RevCharlie in that order.
 */
describe('Tier list – review mode', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  const visitWithCatalog = (prefix: string) => {
    setupRosterUser(prefix, `${prefix}-player`).then(({ adminData }) => {
      const token = adminData.access_token;
      cy.apiLoadChampion(token, 'RevAlpha', 'Cosmic');
      cy.apiLoadChampion(token, 'RevBravo', 'Mystic');
      cy.apiLoadChampion(token, 'RevCharlie', 'Tech');
      cy.clearAllCookies();
      cy.clearAllSessionStorage();
      cy.clearAllLocalStorage();
      cy.visit('/tools');
      cy.contains('3 of 3').should('be.visible');
    });
  };

  const startReview = () => {
    cy.getByCy('tierlist-start-review').click();
    cy.getByCy('tierlist-review').should('be.visible');
  };

  it('cannot start on an empty filtered pool', () => {
    visitWithCatalog('tl-review-empty');

    cy.getByCy('tierlist-search').type('nobodyhere');
    cy.getByCy('tierlist-start-review').should('be.disabled').and('contain', '(0)');
  });

  it('opens on the first champion of the queue', () => {
    visitWithCatalog('tl-review-open');

    startReview();
    cy.getByCy('tierlist-review').should('contain', '1 / 3');
    cy.getByCy('tierlist-review').should('contain', 'RevAlpha');
  });

  it('ranks with the digit keys and moves on', () => {
    visitWithCatalog('tl-review-keys');

    startReview();
    cy.get('body').type('1');
    cy.getByCy('tierlist-review').should('contain', '2 / 3');
    cy.getByCy('tierlist-review').should('contain', 'RevBravo');

    cy.get('body').type('2');
    cy.getByCy('tierlist-review').should('contain', '3 / 3');

    cy.get('body').type('{esc}');
    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-RevAlpha"]').should('exist');
    cy.getByCy('tierlist-row-A').find('[data-cy="tierlist-champion-RevBravo"]').should('exist');
  });

  it('ranks by clicking a row', () => {
    visitWithCatalog('tl-review-click');

    startReview();
    cy.getByCy('review-send-to-B').click();
    cy.getByCy('tierlist-review').should('contain', '2 / 3');

    cy.getByCy('review-quit').click();
    cy.getByCy('tierlist-row-B').find('[data-cy="tierlist-champion-RevAlpha"]').should('exist');
  });

  it('ticks the row count up as the run fills it', () => {
    visitWithCatalog('tl-review-count');

    startReview();
    cy.getByCy('review-send-to-S').should('contain', '0');
    cy.getByCy('review-send-to-S').click();
    cy.getByCy('review-send-to-S').should('contain', '1');
    cy.getByCy('review-send-to-S').click();
    cy.getByCy('review-send-to-S').should('contain', '2');
  });

  it('skips with S and with the right arrow', () => {
    visitWithCatalog('tl-review-skip');

    startReview();
    cy.get('body').type('s');
    cy.getByCy('tierlist-review').should('contain', '2 / 3');

    cy.get('body').type('{rightarrow}');
    cy.getByCy('tierlist-review').should('contain', '3 / 3');
    cy.getByCy('tierlist-review').should('contain', '2 skipped');
  });

  it('goes back to the previous champion with the left arrow', () => {
    visitWithCatalog('tl-review-back');

    startReview();
    cy.get('body').type('{rightarrow}');
    cy.getByCy('tierlist-review').should('contain', 'RevBravo');

    cy.get('body').type('{leftarrow}');
    cy.getByCy('tierlist-review').should('contain', '1 / 3');
    cy.getByCy('tierlist-review').should('contain', 'RevAlpha');
  });

  it('marks the row a champion landed in when coming back to it', () => {
    visitWithCatalog('tl-review-current');

    startReview();
    cy.getByCy('review-send-to-C').click();
    cy.get('body').type('{leftarrow}');

    cy.getByCy('tierlist-review').should('contain', 'RevAlpha');
    cy.getByCy('review-send-to-C').should('have.attr', 'aria-current', 'true');
    cy.getByCy('review-send-to-S').should('not.have.attr', 'aria-current');
  });

  it('quits on Escape', () => {
    visitWithCatalog('tl-review-esc');

    startReview();
    cy.get('body').type('{esc}');
    cy.getByCy('tierlist-review').should('not.exist');
    cy.getByCy('tierlist-pool').should('be.visible');
  });

  it('quits on the cross', () => {
    visitWithCatalog('tl-review-cross');

    startReview();
    cy.getByCy('review-quit').click();
    cy.getByCy('tierlist-review').should('not.exist');
  });

  it('ends on how many were placed', () => {
    visitWithCatalog('tl-review-done');

    startReview();
    cy.getByCy('review-send-to-S').click();
    cy.get('body').type('s');
    cy.get('body').type('s');

    cy.getByCy('tierlist-review').should('contain', 'Run finished');
    cy.getByCy('tierlist-review').should('contain', '1 of 3 champions placed.');
    cy.getByCy('review-close').click();
    cy.getByCy('tierlist-review').should('not.exist');
  });

  it('counts the champions already placed when asked to', () => {
    visitWithCatalog('tl-review-placed');

    cy.getByCy('tierlist-champion-RevAlpha').click();
    cy.getByCy('tierlist-send-to-S').click();
    cy.get('body').type('{esc}');
    cy.getByCy('tierlist-start-review').should('contain', '(2)');

    cy.getByCy('tierlist-review-include-placed').check();
    cy.getByCy('tierlist-start-review').should('contain', '(3)');

    startReview();
    cy.getByCy('tierlist-review').should('contain', '1 / 3');
  });

  it('keeps the queue it started with, whatever gets ranked', () => {
    visitWithCatalog('tl-review-snapshot');

    startReview();
    cy.getByCy('tierlist-review').should('contain', '1 / 3');
    cy.getByCy('review-send-to-S').click();

    // Ranking took RevAlpha out of the pool; the run still walks three.
    cy.getByCy('tierlist-review').should('contain', '2 / 3');
    cy.getByCy('review-send-to-S').click();
    cy.getByCy('tierlist-review').should('contain', '3 / 3');
  });

  it('leaves a text field alone: typing is not a shortcut', () => {
    visitWithCatalog('tl-review-typing');

    startReview();
    // The overlay covers the board, so the title has to be reached by force —
    // what matters is that the keystroke goes to an input, not to the run.
    cy.getByCy('tierlist-title').type('1', { force: true });

    cy.getByCy('tierlist-review').should('contain', '1 / 3');
    cy.getByCy('tierlist-review').should('contain', 'RevAlpha');
  });
});
