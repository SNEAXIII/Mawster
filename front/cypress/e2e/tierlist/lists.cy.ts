import {
  BACKEND,
  closeChampionSheet,
  seedTierList,
  setupTierList,
  visitTierListAs,
  type TierListSetup,
} from '../../support/e2e';

/**
 * Tier lists once signed in: several per account, picked from the selector, and
 * never visible to anyone else — a list belongs to the account, not to a player
 * (see docs/adr/0014).
 */
describe('Tier list – the account lists', () => {
  const CATALOG = [{ name: 'ListHero', championClass: 'Cosmic' }];

  let setup: TierListSetup;

  beforeEach(() => {
    cy.truncateDb();
    setupTierList('tl-lists', CATALOG).then((result) => {
      setup = result;
    });
  });

  it('creates the first list on the first change', () => {
    cy.intercept('POST', '**/api/back/tierlists').as('createList');
    visitTierListAs(setup.userData.user_id);

    cy.getByCy('tierlist-create').should('be.visible');
    cy.getByCy('tierlist-picker').should('not.exist');

    cy.getByCy('tierlist-champion-ListHero').click();
    cy.getByCy('tierlist-send-to-S').click();
    closeChampionSheet();

    cy.wait('@createList').its('response.statusCode').should('eq', 201);
    cy.getByCy('tierlist-picker').should('be.visible');
  });

  it('creates a second list and shows both in the selector', () => {
    seedTierList(setup.userData.access_token, 'Alpha');
    visitTierListAs(setup.userData.user_id);

    cy.getByCy('tierlist-picker').should('contain', 'Alpha');
    cy.getByCy('tierlist-create').click();

    cy.getByCy('tierlist-picker').click();
    cy.get('[role="option"]').should('have.length', 2);
    cy.contains('[role="option"]', 'Alpha').should('exist');
    cy.get('body').type('{esc}');
  });

  it('loads the right board when switching lists', () => {
    seedTierList(setup.userData.access_token, 'Alpha', [setup.championIds.ListHero]);
    seedTierList(setup.userData.access_token, 'Beta');
    visitTierListAs(setup.userData.user_id);

    // Oldest first: Alpha is the one the page opens on.
    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-ListHero"]').should('exist');

    cy.selectOption('tierlist-picker', 'Beta');
    cy.getByCy('tierlist-row-S').should('contain', 'Drop champions here');
    cy.getByCy('tierlist-pool').find('[data-cy="tierlist-champion-ListHero"]').should('exist');

    cy.selectOption('tierlist-picker', 'Alpha');
    cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-ListHero"]').should('exist');
  });

  it('renames a list from the title, and the selector shows it on the next load', () => {
    seedTierList(setup.userData.access_token, 'Alpha');
    cy.intercept('PUT', '**/api/back/tierlists/*').as('saveList');
    visitTierListAs(setup.userData.user_id);

    cy.getByCy('tierlist-title').should('have.value', 'Alpha');
    cy.getByCy('tierlist-title').clear().type('Renamed');
    cy.wait('@saveList').its('response.statusCode').should('eq', 200);

    // The selector reads the summaries the API sent; it picks the new title up
    // on the next load, not while the board is being edited.
    cy.reload();
    cy.getByCy('tierlist-picker').should('contain', 'Renamed');
  });

  it('counts the board being edited, not the snapshot from load time', () => {
    seedTierList(setup.userData.access_token, 'Alpha');
    visitTierListAs(setup.userData.user_id);

    cy.getByCy('tierlist-picker').should('contain', 'Alpha (0)');
    cy.getByCy('tierlist-champion-ListHero').click();
    cy.getByCy('tierlist-send-to-S').click();
    closeChampionSheet();

    cy.getByCy('tierlist-picker').should('contain', 'Alpha (1)');
  });

  it('names the list in the delete confirmation', () => {
    seedTierList(setup.userData.access_token, 'Alpha');
    seedTierList(setup.userData.access_token, 'Beta');
    visitTierListAs(setup.userData.user_id);

    cy.getByCy('tierlist-delete').click();

    cy.contains('Delete "Alpha"?').should('be.visible');
  });

  it('switches to another list once the open one is deleted', () => {
    seedTierList(setup.userData.access_token, 'Alpha');
    seedTierList(setup.userData.access_token, 'Beta');
    visitTierListAs(setup.userData.user_id);

    cy.getByCy('tierlist-title').should('have.value', 'Alpha');
    cy.getByCy('tierlist-delete').click();
    cy.getByCy('confirmation-dialog-confirm').click();

    cy.getByCy('tierlist-title').should('have.value', 'Beta');
    cy.getByCy('tierlist-picker').should('not.contain', 'Alpha');
  });

  it('hides the delete button when a single list is left', () => {
    seedTierList(setup.userData.access_token, 'Alpha');
    seedTierList(setup.userData.access_token, 'Beta');
    visitTierListAs(setup.userData.user_id);

    cy.getByCy('tierlist-delete').click();
    cy.getByCy('confirmation-dialog-confirm').click();

    cy.getByCy('tierlist-title').should('have.value', 'Beta');
    cy.getByCy('tierlist-delete').should('not.exist');
  });

  it('answers 404, not 403, on another account list', () => {
    seedTierList(setup.userData.access_token, 'Private').then((listId) => {
      cy.registerUser('tl-lists-intruder').then((intruder) => {
        cy.request({
          method: 'GET',
          url: `${BACKEND}/tierlists/${listId}`,
          headers: { Authorization: `Bearer ${intruder.access_token}` },
          failOnStatusCode: false,
        })
          .its('status')
          .should('eq', 404);
      });
    });
  });

  it('says so when the twenty-list cap is reached', () => {
    for (let index = 0; index < 20; index += 1) {
      seedTierList(setup.userData.access_token, `List ${index}`);
    }
    visitTierListAs(setup.userData.user_id);

    cy.getByCy('tierlist-create').click();

    cy.getByCy('tierlist-list-error').should(
      'contain',
      'You already hold 20 tier lists. Delete one before creating another.',
    );
  });
});
