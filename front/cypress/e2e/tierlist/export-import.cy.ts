import { setupRosterUser } from '../../support/e2e';

/**
 * Export, import and reset. The PNG capture is only checked through what the
 * page does — that the button goes busy and the controls leave the picture —
 * never through the file itself.
 */
describe('Tier list – export, import, reset', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  /** Resolves to the champion id, which is what an export file carries. */
  const visitWithCatalog = (prefix: string) =>
    setupRosterUser(prefix, `${prefix}-player`).then(({ adminData }) =>
      cy.apiLoadChampion(adminData.access_token, 'ExportHero', 'Cosmic').then((champions) => {
        cy.clearAllCookies();
        cy.clearAllSessionStorage();
        cy.clearAllLocalStorage();
        cy.visit('/tools');
        cy.getByCy('tierlist-pool').should('exist');
        return cy.wrap(champions[0].id as string);
      }),
    );

  const pickFile = (contents: string) =>
    cy.get('input[type="file"]').selectFile(
      {
        contents: Cypress.Buffer.from(contents),
        fileName: 'board.json',
        mimeType: 'application/json',
      },
      { force: true },
    );

  const boardFile = (championIds: string[]) =>
    JSON.stringify({
      version: 1,
      title: 'Imported list',
      tiers: [
        { label: 'God', color: '#ff7f7f', championIds },
        { label: 'Meh', color: '#7fbfff', championIds: [] },
      ],
      tags: {},
    });

  it('exports a JSON file named after the board and the day', () => {
    visitWithCatalog('tl-export-json').then(() => {
      cy.getByCy('tierlist-title').type('My List');
      cy.window().then((win) => {
        cy.stub(win.HTMLAnchorElement.prototype, 'click').as('download');
      });

      cy.getByCy('tierlist-export-json').click();

      const today = new Date().toISOString().slice(0, 10);
      cy.get('@download').should((stub) => {
        const anchor = (stub as unknown as { thisValues: HTMLAnchorElement[] }).thisValues[0];
        expect(anchor.download).to.eq(`my-list-${today}.json`);
      });
    });
  });

  it('imports a valid file over the open board', () => {
    visitWithCatalog('tl-import-json').then((championId) => {
      pickFile(boardFile([championId]));

      cy.contains('Tier list imported.').should('be.visible');
      cy.getByCy('tierlist-row-God').find('[data-cy="tierlist-champion-ExportHero"]').should('exist');
      cy.getByCy('tierlist-row-Meh').should('contain', 'Drop champions here');
      cy.getByCy('tierlist-row-S').should('not.exist');
      cy.getByCy('tierlist-title').should('have.value', 'Imported list');
    });
  });

  it('refuses a file that is not one of ours and keeps the board', () => {
    visitWithCatalog('tl-import-bad').then(() => {
      pickFile('this is not json at all');

      cy.contains('This file is not a valid tier list export.').should('be.visible');
      cy.getByCy('tierlist-row-S').should('exist');
      cy.getByCy('tierlist-pool').find('[data-cy="tierlist-champion-ExportHero"]').should('exist');
    });
  });

  it('drops champions the catalog no longer holds', () => {
    visitWithCatalog('tl-import-unknown').then((championId) => {
      pickFile(boardFile([championId, '11111111-2222-3333-4444-555555555555']));

      cy.contains('Tier list imported.').should('be.visible');
      cy.getByCy('tierlist-row-God').find('[data-cy^="tierlist-champion-"]').should('have.length', 1);
      cy.contains('0 of 1').should('be.visible');
    });
  });

  it('asks before resetting, then starts over on five empty rows', () => {
    visitWithCatalog('tl-reset').then(() => {
      cy.getByCy('tierlist-champion-ExportHero').click();
      cy.getByCy('tierlist-send-to-S').click();
      cy.get('body').type('{esc}');
      cy.getByCy('tierlist-add-row').click();

      cy.getByCy('tierlist-reset').click();
      cy.contains('Reset this tier list? Its rows and tags will be lost.').should('be.visible');
      cy.getByCy('confirmation-dialog-confirm').click();

      cy.getByCy('tierlist-row-F').should('not.exist');
      for (const label of ['S', 'A', 'B', 'C', 'D']) {
        cy.getByCy(`tierlist-row-${label}`).should('contain', 'Drop champions here');
      }
      cy.getByCy('tierlist-pool').find('[data-cy="tierlist-champion-ExportHero"]').should('exist');
    });
  });

  it('goes busy while it captures the PNG, controls out of the picture', () => {
    visitWithCatalog('tl-export-png').then(() => {
      cy.getByCy('tierlist-export-png').click();

      // The capture waits two frames before it starts, so this is what the
      // board looks like while it runs: no row controls, no colour pickers.
      cy.getByCy('tierlist-export-png').should('be.disabled');
      cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-row-remove"]').should('not.exist');
      cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-row-color"]').should('not.exist');
      cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-row-label"]').should('not.exist');

      cy.getByCy('tierlist-export-png').should('not.be.disabled');
      cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-row-remove"]').should('exist');
    });
  });
});
