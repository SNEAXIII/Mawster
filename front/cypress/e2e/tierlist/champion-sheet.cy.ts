import { setupRosterUser } from '../../support/e2e';

/**
 * The champion sheet: the touch-friendly counterpart of dragging. It sets the
 * tags, the signature and the row, so it is also how the specs move a champion —
 * dnd-kit's pointer constraints are not reproducible from Cypress.
 */
describe('Tier list – champion sheet', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  /** Two champions: one ascendable and aliased, one plain. */
  const visitWithCatalog = (prefix: string) => {
    setupRosterUser(prefix, `${prefix}-player`).then(({ adminData }) => {
      cy.apiLoadChampion(adminData.access_token, 'SheetHero', 'Mutant', {
        is_ascendable: true,
        alias: 'Sheety',
      });
      cy.apiLoadChampion(adminData.access_token, 'PlainHero', 'Skill');
      cy.clearAllCookies();
      cy.clearAllSessionStorage();
      cy.clearAllLocalStorage();
      cy.visit('/tools');
    });
  };

  const openSheet = (name: string) => {
    cy.getByCy(`tierlist-champion-${name}`).first().click();
    cy.getByCy('tierlist-champion-sheet').should('be.visible');
  };

  const closeSheet = () => {
    cy.get('body').type('{esc}');
    cy.getByCy('tierlist-champion-sheet').should('not.exist');
  };

  it('opens on a champion with its name, class and alias', () => {
    visitWithCatalog('tl-sheet-open');

    openSheet('SheetHero');
    cy.getByCy('tierlist-champion-sheet').should('contain', 'SheetHero');
    cy.getByCy('tierlist-champion-sheet').should('contain', 'Mutant');
    cy.getByCy('tierlist-champion-sheet').should('contain', 'Sheety');
  });

  it('mentions ascension only for an ascendable champion', () => {
    visitWithCatalog('tl-sheet-asc');

    openSheet('SheetHero');
    cy.getByCy('tierlist-champion-sheet').should('contain', 'Ascendable');
    closeSheet();

    openSheet('PlainHero');
    cy.getByCy('tierlist-champion-sheet').should('not.contain', 'Ascendable');
  });

  it('toggles every tag, and the card wears the badge', () => {
    visitWithCatalog('tl-sheet-tags');

    openSheet('PlainHero');
    const badges: Array<[string, string]> = [
      ['is_attacker', 'attacker'],
      ['is_defender', 'defender'],
      ['is_alliance_war', 'aw'],
      ['is_battlegrounds', 'bg'],
      ['is_awakened', 'awk'],
    ];
    for (const [key, badge] of badges) {
      cy.getByCy(`tierlist-tag-${key}`).click();
      cy.getByCy(`tierlist-champion-PlainHero`).find(`[data-cy="tierlist-badge-${badge}"]`).should('exist');
      cy.getByCy(`tierlist-tag-${key}`).click();
      cy.getByCy(`tierlist-champion-PlainHero`).find(`[data-cy="tierlist-badge-${badge}"]`).should('not.exist');
    }
  });

  it('shows the signature field only once the champion is awakened', () => {
    visitWithCatalog('tl-sheet-sig-gate');

    openSheet('PlainHero');
    cy.getByCy('tierlist-signature').should('not.exist');
    cy.getByCy('tierlist-tag-is_awakened').click();
    cy.getByCy('tierlist-signature').should('be.visible');
    cy.getByCy('tierlist-tag-is_awakened').click();
    cy.getByCy('tierlist-signature').should('not.exist');
  });

  it('sets the signature from the presets', () => {
    visitWithCatalog('tl-sheet-presets');

    openSheet('PlainHero');
    cy.getByCy('tierlist-tag-is_awakened').click();
    for (const preset of [20, 60, 100, 200]) {
      cy.getByCy('tierlist-champion-sheet').contains('button', `x${preset}`).click();
      cy.getByCy('tierlist-signature').should('have.value', String(preset));
    }
  });

  it('keeps the signature within 0 and 200', () => {
    visitWithCatalog('tl-sheet-sig-bounds');

    openSheet('PlainHero');
    cy.getByCy('tierlist-tag-is_awakened').click();
    cy.getByCy('tierlist-signature').should('have.attr', 'min', '0');
    cy.getByCy('tierlist-signature').should('have.attr', 'max', '200');

    cy.getByCy('tierlist-signature').clear().type('500');
    cy.getByCy('tierlist-signature').should('have.value', '200');
  });

  it('clears the tags back to nothing', () => {
    visitWithCatalog('tl-sheet-clear');

    openSheet('PlainHero');
    cy.getByCy('tierlist-tag-is_attacker').click();
    cy.getByCy('tierlist-tag-is_awakened').click();
    cy.getByCy('tierlist-champion-sheet').contains('button', 'x100').click();

    cy.getByCy('tierlist-clear-tags').click();
    cy.getByCy('tierlist-signature').should('not.exist');
    cy.getByCy('tierlist-champion-PlainHero').find('[data-cy^="tierlist-badge-"]').should('not.exist');
  });

  it('sends a champion to a row and out of the pool', () => {
    visitWithCatalog('tl-sheet-send');

    openSheet('PlainHero');
    cy.getByCy('tierlist-send-to-S').click();
    closeSheet();

    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-PlainHero"]').should('exist');
    cy.getByCy('tierlist-pool').find('[data-cy="tierlist-champion-PlainHero"]').should('not.exist');
    cy.contains('1 of 2').should('be.visible');
  });

  it('disables the row the champion already sits in', () => {
    visitWithCatalog('tl-sheet-current-row');

    openSheet('PlainHero');
    cy.getByCy('tierlist-send-to-S').should('not.be.disabled');
    cy.getByCy('tierlist-send-to-S').click();
    cy.getByCy('tierlist-send-to-S').should('be.disabled');
    cy.getByCy('tierlist-send-to-A').should('not.be.disabled');
  });

  it('sends a ranked champion back to the pool, and only then', () => {
    visitWithCatalog('tl-sheet-back');

    openSheet('PlainHero');
    cy.getByCy('tierlist-back-to-pool').should('be.disabled');
    cy.getByCy('tierlist-send-to-B').click();
    cy.getByCy('tierlist-back-to-pool').should('not.be.disabled').click();
    closeSheet();

    cy.getByCy('tierlist-pool').find('[data-cy="tierlist-champion-PlainHero"]').should('exist');
    cy.getByCy('tierlist-row-B').should('contain', 'Drop champions here');
  });

  it('keeps the tags across a reload', () => {
    visitWithCatalog('tl-sheet-persist');

    openSheet('PlainHero');
    cy.getByCy('tierlist-tag-is_alliance_war').click();
    cy.getByCy('tierlist-tag-is_awakened').click();
    cy.getByCy('tierlist-champion-sheet').contains('button', 'x60').click();
    closeSheet();

    cy.window().its('localStorage').invoke('getItem', 'mawster-tierlist:board').should('contain', '"signature":60');

    cy.reload();

    openSheet('PlainHero');
    cy.getByCy('tierlist-signature').should('have.value', '60');
    cy.getByCy('tierlist-champion-sheet').should('be.visible');
  });
});
