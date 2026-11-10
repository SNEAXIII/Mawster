import {
  closeChampionSheet,
  setupTierList,
  visitTierListSignedOut,
  visitTierListWith,
  type TierListSetup,
} from '../../support/e2e';

/** Several tier lists per browser, picked from the selector. */
describe('Tier list – the browser lists', () => {
  const CATALOG = [{ name: 'ListHero', championClass: 'Cosmic' }];

  let setup: TierListSetup;

  beforeEach(() => {
    cy.truncateDb();
    setupTierList('tl-lists', CATALOG).then((result) => {
      setup = result;
    });
  });

  it('creates the first list on the first change', () => {
    visitTierListSignedOut();

    cy.getByCy('tierlist-create').should('be.visible');
    cy.getByCy('tierlist-picker').should('not.exist');

    cy.getByCy('tierlist-champion-ListHero').click();
    cy.getByCy('tierlist-send-to-S').click();
    closeChampionSheet();

    cy.getByCy('tierlist-picker').should('be.visible');
  });

  it('creates a second list and shows both in the selector', () => {
    visitTierListWith([{ title: 'Alpha' }]);

    cy.getByCy('tierlist-picker').should('contain', 'Alpha');
    cy.getByCy('tierlist-create').click();

    cy.getByCy('tierlist-picker').click();
    cy.get('[role="option"]').should('have.length', 2);
    cy.contains('[role="option"]', 'Alpha').should('exist');
    cy.get('body').type('{esc}');
  });

  it('loads the right board when switching lists', () => {
    visitTierListWith([{ title: 'Alpha', championIds: [setup.championIds.ListHero] }, { title: 'Beta' }]);

    cy.selectOption('tierlist-picker', 'Alpha');
    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-ListHero"]').should('exist');

    cy.selectOption('tierlist-picker', 'Beta');
    cy.getByCy('tierlist-row-S').should('contain', 'Drop champions here');
    cy.getByCy('tierlist-pool').find('[data-cy="tierlist-champion-ListHero"]').should('exist');

    cy.selectOption('tierlist-picker', 'Alpha');
    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-ListHero"]').should('exist');
  });

  it('renames a list from the title, and the selector shows it on the next load', () => {
    visitTierListWith([{ title: 'Alpha' }]);

    cy.getByCy('tierlist-title').should('have.value', 'Alpha');
    cy.getByCy('tierlist-title').clear().type('Renamed');

    cy.reload();
    cy.getByCy('tierlist-picker').should('contain', 'Renamed');
  });

  it('counts the board being edited, not the snapshot from load time', () => {
    visitTierListWith([{ title: 'Alpha' }]);

    cy.getByCy('tierlist-picker').should('contain', 'Alpha (0)');
    cy.getByCy('tierlist-champion-ListHero').click();
    cy.getByCy('tierlist-send-to-S').click();
    closeChampionSheet();

    cy.getByCy('tierlist-picker').should('contain', 'Alpha (1)');
  });

  it('names the list in the delete confirmation', () => {
    visitTierListWith([{ title: 'Alpha' }, { title: 'Beta' }]);

    cy.selectOption('tierlist-picker', 'Alpha');
    cy.getByCy('tierlist-delete').click();

    cy.contains('Delete "Alpha"?').should('be.visible');
  });

  it('switches to another list once the open one is deleted', () => {
    visitTierListWith([{ title: 'Alpha' }, { title: 'Beta' }]);

    cy.selectOption('tierlist-picker', 'Alpha');
    cy.getByCy('tierlist-title').should('have.value', 'Alpha');
    cy.getByCy('tierlist-delete').click();
    cy.getByCy('confirmation-dialog-confirm').click();

    cy.getByCy('tierlist-title').should('have.value', 'Beta');
    cy.getByCy('tierlist-picker').should('not.contain', 'Alpha');
  });

  it('hides the delete button when a single list is left', () => {
    visitTierListWith([{ title: 'Alpha' }, { title: 'Beta' }]);

    cy.selectOption('tierlist-picker', 'Alpha');
    cy.getByCy('tierlist-delete').click();
    cy.getByCy('confirmation-dialog-confirm').click();

    cy.getByCy('tierlist-title').should('have.value', 'Beta');
    cy.getByCy('tierlist-delete').should('not.exist');
  });

  it('says so when the twenty-list cap is reached', () => {
    visitTierListWith(Array.from({ length: 20 }, (_, index) => ({ title: `List ${index}` })));

    cy.getByCy('tierlist-create').click();

    cy.getByCy('tierlist-list-error').should(
      'contain',
      'You already hold 20 tier lists. Delete one before creating another.',
    );
  });
});
