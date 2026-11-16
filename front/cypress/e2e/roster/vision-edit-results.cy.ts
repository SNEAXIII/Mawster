import { setupRosterUser } from '../../support/e2e';
import {
  SHOTS,
  type RosterRow,
  assertPreviewMatchesShots,
  getRoster,
  loadShotChampions,
  rowIndexOf,
  uploadShots,
} from '../../support/vision';

// A clean read has no issue, and only a row with one offers "ignore": these two
// predictions get an unreadable rank (7r0) on their way to the front.
const UNREADABLE = ['Mojo', 'Prowler'];
const EDITED = ['Kindred', 'Sentinel', 'Photon', 'Knull', ...UNREADABLE];

describe('Roster – Vision import: editing the read results', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('saves every edit made in the review, and nothing from an ignored row', () => {
    setupRosterUser('vision-edit', 'EditPlayer').then(({ adminData, userData, accountId }) => {
      const token = userData.access_token;
      // Sentinel, Photon and Knull owned exactly as the shot shows them: their rows start "unchanged".
      loadShotChampions(adminData.access_token, ['shot_0001.png'], ['Mordo']).then((champs) => {
        cy.apiAddChampionToRoster(token, accountId, champs['Sentinel'].id, '7r5', { signature: 200 });
        cy.apiAddChampionToRoster(token, accountId, champs['Photon'].id, '7r4', { signature: 200 });
        cy.apiAddChampionToRoster(token, accountId, champs['Knull'].id, '7r4', { signature: 200, ascension: 1 });
        cy.apiAddChampionToRoster(token, accountId, champs['Mordo'].id, '7r3');
      });

      cy.intercept('GET', '**/vision/imports/*/predictions', (req) => {
        req.continue((res) => {
          const body = res.body as { predictions: { champion_name: string | null; rank: number }[] };
          for (const p of body.predictions) if (UNREADABLE.includes(p.champion_name ?? '')) p.rank = 0;
        });
      });

      cy.apiLogin(userData.user_id, 'roster');
      uploadShots('shot_0001.png');
      assertPreviewMatchesShots(['shot_0001.png'], { Mojo: { rarity: '7r0' }, Prowler: { rarity: '7r0' } });

      // Champion: Kindred corrected to Mordo, owned at 7r3.
      rowIndexOf('Kindred').then((i) => {
        cy.getByCy(`preview-row-status-badge-${i}`).should('have.attr', 'data-status', 'new');
        cy.getByCy(`preview-row-champion-trigger-${i}`).click();
        cy.getByCy(`preview-row-champion-popover-${i}`).should('be.visible');
        cy.getByCy(`preview-row-catalog-${i}-Mordo`).click();
        cy.getByCy(`preview-row-status-badge-${i}`).should('have.attr', 'data-status', 'updated');
        cy.getByCy(`preview-row-score-badge-${i}`).should('have.attr', 'data-level', 'corrected');
      });

      // Rarity, signature, ascension: each turns an unchanged row into an update, the score untouched.
      const edits: [string, (i: number) => void][] = [
        ['Sentinel', (i) => cy.selectOption(`preview-row-rarity-select-${i}`, '7R6')],
        ['Photon', (i) => cy.getByCy(`preview-row-signature-input-${i}`).clear().type('150')],
        ['Knull', (i) => cy.getByCy(`preview-row-ascension-input-${i}`).clear().type('2')],
      ];
      for (const [name, edit] of edits) {
        rowIndexOf(name).then((i) => {
          cy.getByCy(`preview-row-status-badge-${i}`).should('have.attr', 'data-status', 'unchanged');
          edit(i);
          cy.getByCy(`preview-row-status-badge-${i}`).should('have.attr', 'data-status', 'updated');
          cy.getByCy(`preview-row-score-badge-${i}`).should('not.have.attr', 'data-level', 'corrected');
        });
      }

      // Ignore then restore: the row comes back with its issue, fixed by picking the rank.
      rowIndexOf('Mojo').then((i) => {
        cy.getByCy(`preview-row-score-badge-${i}`).should('have.attr', 'data-level', 'low');
        cy.getByCy(`preview-row-ignore-button-${i}`).click();
        cy.getByCy(`preview-row-${i}`).should('have.attr', 'data-ignored', 'true');
        cy.getByCy(`preview-row-issues-${i}`).should('not.exist');
        cy.getByCy(`preview-row-restore-button-${i}`).click();
        cy.getByCy(`preview-row-${i}`).should('have.attr', 'data-ignored', 'false');
        cy.getByCy(`preview-row-issues-${i}`).should('be.visible');
        cy.selectOption(`preview-row-rarity-select-${i}`, '7R4');
        cy.getByCy(`preview-row-issues-${i}`).should('not.exist');
        cy.getByCy(`preview-row-status-badge-${i}`).should('have.attr', 'data-status', 'new');
      });

      rowIndexOf('Prowler').then((i) => {
        cy.getByCy(`preview-row-ignore-button-${i}`).click();
        cy.getByCy(`preview-row-${i}`).should('have.attr', 'data-ignored', 'true');
      });
      cy.getByCy('import-preview-ignored-count').should('be.visible');

      cy.getByCy('import-preview-confirm-button').should('be.enabled').click();
      cy.get('[data-cy="import-report-close-button"]', { timeout: 30000 }).click();

      getRoster(token, accountId).then((roster) => {
        const saved = (name: string) =>
          roster
            .filter((r) => r.champion_name === name)
            .map(({ rarity, signature, ascension }: RosterRow) => ({ rarity, signature, ascension }));
        expect(saved('Kindred')).to.deep.equal([]);
        expect(saved('Mordo')).to.deep.equal([{ rarity: '7r4', signature: 200, ascension: 1 }]);
        expect(saved('Sentinel')).to.deep.equal([{ rarity: '7r6', signature: 200, ascension: 0 }]);
        expect(saved('Photon')).to.deep.equal([{ rarity: '7r4', signature: 150, ascension: 0 }]);
        expect(saved('Knull')).to.deep.equal([{ rarity: '7r4', signature: 200, ascension: 2 }]);
        expect(saved('Mojo')).to.deep.equal([{ rarity: '7r4', signature: 200, ascension: 1 }]);
        expect(saved('Prowler')).to.deep.equal([]);
        for (const [name, card] of Object.entries(SHOTS['shot_0001.png'])) {
          if (!EDITED.includes(name)) expect(saved(name), name).to.deep.equal([card]);
        }
      });
    });
  });
});
