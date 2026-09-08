import { rankChampion, setupTierList, storedBoard, visitTierListSignedOut } from '../../support/e2e';

/**
 * The rows of the board: added, renamed, recoloured, reordered, emptied and
 * deleted. Signed out throughout — a row is board state, and the board is the
 * same object whether it lives in an account or in the browser.
 */
describe('Tier list – rows', () => {
  const CATALOG = [
    { name: 'RowHero', championClass: 'Cosmic' },
    { name: 'RowMate', championClass: 'Mystic' },
  ];

  beforeEach(() => {
    cy.truncateDb();
    setupTierList('tl-rows', CATALOG);
    visitTierListSignedOut();
  });

  /**
   * A colour input, set the way React hears it: jQuery's `val()` alone leaves
   * React's value tracker thinking nothing changed, so onChange never fires.
   */
  const setColor = (selector: string, value: string) => {
    cy.get(selector).then(($input) => {
      const input = $input[0] as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  it('adds a row with the next label and the next colour', () => {
    cy.getByCy('tierlist-row-F').should('not.exist');
    cy.getByCy('tierlist-add-row').click();

    cy.getByCy('tierlist-row-F').should('exist');
    cy.getByCy('tierlist-row-F').find('[data-cy="tierlist-row-color"]').should('have.value', '#7fff7f');
  });

  it('renames a row, and the name survives a reload', () => {
    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-row-label"]').type('{selectall}God');
    cy.getByCy('tierlist-row-God').should('exist');
    cy.getByCy('tierlist-row-S').should('not.exist');

    storedBoard().should('contain', 'God');

    cy.reload();
    cy.getByCy('tierlist-row-God').should('exist');
  });

  it('recolours a row', () => {
    setColor('[data-cy="tierlist-row-color"]:first', '#123456');
    // The picker commits shortly after it stops moving, so the board only hears
    // about the colour once — waiting on the stored board is waiting on that.
    storedBoard().should('contain', '#123456');

    cy.reload();
    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-row-color"]').should('have.value', '#123456');
  });

  it('puts the colour input under the pencil, where the click lands', () => {
    // The palette itself is a dialog of the operating system — nothing in the
    // page, so nothing to drive. What can go wrong here is the pair coming
    // apart: a pencil one sees over an input the pointer never reaches, or an
    // input sitting somewhere else entirely. So the click target is what this
    // checks, by asking the document what is actually at the pencil's centre.
    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-row-color"]').parent().find('svg').should('exist');

    cy.getByCy('tierlist-row-S')
      .find('[data-cy="tierlist-row-color"]')
      .then(($input) => {
        const input = $input[0];
        const { x, y, width, height } = input.getBoundingClientRect();
        expect(width, 'the input has a width to click').to.be.greaterThan(0);
        cy.document().then((doc) => {
          expect(doc.elementFromPoint(x + width / 2, y + height / 2)).to.eq(input);
        });
      });
  });

  it('moves a row up and down, and stops at both ends', () => {
    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-row-up"]').should('be.disabled');
    cy.getByCy('tierlist-row-D').find('[data-cy="tierlist-row-down"]').should('be.disabled');

    cy.getByCy('tierlist-row-A').find('[data-cy="tierlist-row-up"]').click();
    cy.getByCy('tierlist-row-A').invoke('index').should('eq', 0);
    cy.getByCy('tierlist-row-S').invoke('index').should('eq', 1);
    cy.getByCy('tierlist-row-A').find('[data-cy="tierlist-row-up"]').should('be.disabled');

    cy.getByCy('tierlist-row-A').find('[data-cy="tierlist-row-down"]').click();
    cy.getByCy('tierlist-row-A').invoke('index').should('eq', 1);
    cy.getByCy('tierlist-row-S').invoke('index').should('eq', 0);
  });

  it('asks before emptying a row, and cancelling changes nothing', () => {
    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-row-clear"]').should('be.disabled');
    rankChampion('RowHero', 'S');

    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-row-clear"]').click();
    cy.contains('Send the 1 champions in row S back to the pool?').should('be.visible');
    cy.getByCy('confirmation-dialog-cancel').click();

    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-RowHero"]').should('exist');
  });

  it('empties a row back into the pool once confirmed', () => {
    rankChampion('RowHero', 'S');
    rankChampion('RowMate', 'S');
    cy.contains('0 of 2').should('be.visible');

    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-row-clear"]').click();
    cy.getByCy('confirmation-dialog-confirm').click();

    cy.getByCy('tierlist-row-S').should('contain', 'Drop champions here');
    cy.getByCy('tierlist-pool').find('[data-cy="tierlist-champion-RowHero"]').should('exist');
    cy.getByCy('tierlist-pool').find('[data-cy="tierlist-champion-RowMate"]').should('exist');
    cy.contains('2 of 2').should('be.visible');
  });

  it('asks before deleting a row, and its champions come back', () => {
    rankChampion('RowHero', 'A');

    cy.getByCy('tierlist-row-A').find('[data-cy="tierlist-row-remove"]').click();
    cy.contains('Delete row A? Its champions go back to the pool.').should('be.visible');
    cy.getByCy('confirmation-dialog-confirm').click();

    cy.getByCy('tierlist-row-A').should('not.exist');
    cy.getByCy('tierlist-pool').find('[data-cy="tierlist-champion-RowHero"]').should('exist');
    cy.contains('2 of 2').should('be.visible');
  });

  it('will not delete the last row left', () => {
    for (const label of ['A', 'B', 'C', 'D']) {
      cy.getByCy(`tierlist-row-${label}`).find('[data-cy="tierlist-row-remove"]').click();
      cy.getByCy('confirmation-dialog-confirm').click();
      cy.getByCy(`tierlist-row-${label}`).should('not.exist');
    }

    cy.getByCy('tierlist-row-S').should('exist');
    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-row-remove"]').should('be.disabled');
  });
});
