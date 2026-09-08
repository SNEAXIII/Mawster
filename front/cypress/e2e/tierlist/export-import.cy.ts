import { setupTierList, visitTierListSignedOut, type TierListSetup } from '../../support/e2e';

/**
 * Export, import and reset. The PNG is checked by the file that lands in the
 * downloads folder, never by its pixels.
 */
describe('Tier list – export, import, reset', () => {
  const CATALOG = [{ name: 'ExportHero', championClass: 'Cosmic' }];

  let setup: TierListSetup;

  beforeEach(() => {
    cy.truncateDb();
    setupTierList('tl-export', CATALOG).then((result) => {
      setup = result;
    });
    visitTierListSignedOut();
  });

  const today = () => new Date().toISOString().slice(0, 10);

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
    cy.getByCy('tierlist-title').type('My List');
    cy.window().then((win) => {
      cy.stub(win.HTMLAnchorElement.prototype, 'click').as('download');
    });

    cy.getByCy('tierlist-export-json').click();

    cy.get('@download').should((stub) => {
      const anchor = (stub as unknown as { thisValues: HTMLAnchorElement[] }).thisValues[0];
      expect(anchor.download).to.eq(`my-list-${today()}.json`);
    });
  });

  it('imports a valid file over the open board', () => {
    pickFile(boardFile([setup.championIds.ExportHero]));

    cy.contains('Tier list imported.').should('be.visible');
    cy.getByCy('tierlist-row-God').find('[data-cy="tierlist-champion-ExportHero"]').should('exist');
    cy.getByCy('tierlist-row-Meh').should('contain', 'Drop champions here');
    cy.getByCy('tierlist-row-S').should('not.exist');
    cy.getByCy('tierlist-title').should('have.value', 'Imported list');
  });

  it('refuses a file that is not one of ours and keeps the board', () => {
    pickFile('this is not json at all');

    cy.contains('This file is not a valid tier list export.').should('be.visible');
    cy.getByCy('tierlist-row-S').should('exist');
    cy.getByCy('tierlist-pool').find('[data-cy="tierlist-champion-ExportHero"]').should('exist');
  });

  it('drops champions the catalog no longer holds', () => {
    pickFile(boardFile([setup.championIds.ExportHero, '11111111-2222-3333-4444-555555555555']));

    cy.contains('Tier list imported.').should('be.visible');
    cy.getByCy('tierlist-row-God').find('[data-cy^="tierlist-champion-"]').should('have.length', 1);
    cy.contains('0 of 1').should('be.visible');
  });

  it('asks before resetting, then starts over on five empty rows', () => {
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

  it('downloads the board as a PNG', () => {
    cy.getByCy('tierlist-title').type('Png Board');

    cy.getByCy('tierlist-export-png').click();
    // The capture waits for the portraits and two frames before it fires, so
    // the file takes noticeably longer to appear than a click usually does.
    cy.getByCy('tierlist-export-png').should('not.be.disabled');

    cy.readFile(`cypress/downloads/png-board-${today()}.png`, null, { timeout: 20000 })
      .its('length')
      .should('be.gt', 1000);
  });
});
