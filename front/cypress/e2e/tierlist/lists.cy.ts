import { BACKEND, setupRosterUser } from '../../support/e2e';

/**
 * Tier lists once signed in: several per account, picked from the selector, and
 * never visible to anyone else — a list belongs to the account, not to a player
 * (see docs/adr/0014).
 */
describe('Tier list – the account lists', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  const emptyTiers = () =>
    ['S', 'A', 'B', 'C', 'D'].map((label) => ({
      label,
      color: '#ff7f7f',
      champion_ids: [] as string[],
    }));

  /** Create a list straight through the API, so a spec can start with several. */
  const seedList = (token: string, title: string, championIds: string[] = []) =>
    cy
      .request({
        method: 'POST',
        url: `${BACKEND}/tierlists`,
        headers: { Authorization: `Bearer ${token}` },
        body: {
          title,
          tiers: emptyTiers().map((tier, index) => (index === 0 ? { ...tier, champion_ids: championIds } : tier)),
          tags: [],
        },
      })
      .then((res) => {
        expect(res.status).to.eq(201);
        return res.body.id as string;
      });

  it('creates the first list on the first change', () => {
    setupRosterUser('tl-lists-first', 'FirstLister').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'ListHero', 'Cosmic');
      cy.intercept('POST', '**/api/back/tierlists').as('createList');
      cy.apiLogin(userData.user_id, '/tools');

      cy.getByCy('tierlist-create').should('be.visible');
      cy.getByCy('tierlist-picker').should('not.exist');

      cy.getByCy('tierlist-champion-ListHero').click();
      cy.getByCy('tierlist-send-to-S').click();
      cy.get('body').type('{esc}');

      cy.wait('@createList').its('response.statusCode').should('eq', 201);
      cy.getByCy('tierlist-picker').should('be.visible');
    });
  });

  it('creates a second list and shows both in the selector', () => {
    setupRosterUser('tl-lists-second', 'SecondLister').then(({ userData }) => {
      seedList(userData.access_token, 'Alpha');
      cy.apiLogin(userData.user_id, '/tools');

      cy.getByCy('tierlist-picker').should('contain', 'Alpha');
      cy.getByCy('tierlist-create').click();

      cy.getByCy('tierlist-picker').click();
      cy.get('[role="option"]').should('have.length', 2);
      cy.contains('[role="option"]', 'Alpha').should('exist');
      cy.get('body').type('{esc}');
    });
  });

  it('loads the right board when switching lists', () => {
    setupRosterUser('tl-lists-switch', 'SwitchLister').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'SwitchHero', 'Tech').then((champions) => {
        seedList(userData.access_token, 'Alpha', [champions[0].id]);
        seedList(userData.access_token, 'Beta');
        cy.apiLogin(userData.user_id, '/tools');

        // Oldest first: Alpha is the one the page opens on.
        cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-SwitchHero"]').should('exist');

        cy.selectOption('tierlist-picker', 'Beta');
        cy.getByCy('tierlist-row-S').should('contain', 'Drop champions here');
        cy.getByCy('tierlist-pool').find('[data-cy="tierlist-champion-SwitchHero"]').should('exist');

        cy.selectOption('tierlist-picker', 'Alpha');
        cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-SwitchHero"]').should('exist');
      });
    });
  });

  it('renames a list from the title, and the selector shows it on the next load', () => {
    setupRosterUser('tl-lists-rename', 'RenameLister').then(({ userData }) => {
      seedList(userData.access_token, 'Alpha');
      cy.intercept('PUT', '**/api/back/tierlists/*').as('saveList');
      cy.apiLogin(userData.user_id, '/tools');

      cy.getByCy('tierlist-title').should('have.value', 'Alpha');
      cy.getByCy('tierlist-title').clear().type('Renamed');
      cy.wait('@saveList').its('response.statusCode').should('eq', 200);

      // The selector reads the summaries the API sent; it picks the new title
      // up on the next load, not while the board is being edited.
      cy.reload();
      cy.getByCy('tierlist-picker').should('contain', 'Renamed');
    });
  });

  it('counts the board being edited, not the snapshot from load time', () => {
    setupRosterUser('tl-lists-count', 'CountLister').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'CountHero', 'Skill');
      seedList(userData.access_token, 'Alpha');
      cy.apiLogin(userData.user_id, '/tools');

      cy.getByCy('tierlist-picker').should('contain', 'Alpha (0)');
      cy.getByCy('tierlist-champion-CountHero').click();
      cy.getByCy('tierlist-send-to-S').click();
      cy.get('body').type('{esc}');

      cy.getByCy('tierlist-picker').should('contain', 'Alpha (1)');
    });
  });

  it('names the list in the delete confirmation', () => {
    setupRosterUser('tl-lists-confirm', 'ConfirmLister').then(({ userData }) => {
      seedList(userData.access_token, 'Alpha');
      seedList(userData.access_token, 'Beta');
      cy.apiLogin(userData.user_id, '/tools');

      cy.getByCy('tierlist-delete').click();
      cy.contains('Delete "Alpha"?').should('be.visible');
    });
  });

  it('switches to another list once the open one is deleted', () => {
    setupRosterUser('tl-lists-delete', 'DeleteLister').then(({ userData }) => {
      seedList(userData.access_token, 'Alpha');
      seedList(userData.access_token, 'Beta');
      cy.apiLogin(userData.user_id, '/tools');

      cy.getByCy('tierlist-title').should('have.value', 'Alpha');
      cy.getByCy('tierlist-delete').click();
      cy.getByCy('confirmation-dialog-confirm').click();

      cy.getByCy('tierlist-title').should('have.value', 'Beta');
      cy.getByCy('tierlist-picker').should('not.contain', 'Alpha');
    });
  });

  it('hides the delete button when a single list is left', () => {
    setupRosterUser('tl-lists-last', 'LastLister').then(({ userData }) => {
      seedList(userData.access_token, 'Alpha');
      seedList(userData.access_token, 'Beta');
      cy.apiLogin(userData.user_id, '/tools');

      cy.getByCy('tierlist-delete').click();
      cy.getByCy('confirmation-dialog-confirm').click();

      cy.getByCy('tierlist-title').should('have.value', 'Beta');
      cy.getByCy('tierlist-delete').should('not.exist');
    });
  });

  it('answers 404, not 403, on another account list', () => {
    setupRosterUser('tl-lists-owner', 'OwnerLister').then(({ userData: owner }) => {
      seedList(owner.access_token, 'Private').then((listId) => {
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
  });

  it('refuses a twenty-first list with a 409', () => {
    setupRosterUser('tl-lists-cap', 'CapLister').then(({ userData }) => {
      for (let index = 0; index < 20; index += 1) {
        seedList(userData.access_token, `List ${index}`);
      }
      cy.request({
        method: 'POST',
        url: `${BACKEND}/tierlists`,
        headers: { Authorization: `Bearer ${userData.access_token}` },
        body: { title: 'One too many', tiers: emptyTiers(), tags: [] },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(409);
      });
    });
  });
});
