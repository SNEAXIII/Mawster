import { setupRosterUser } from '../../support/e2e';
import { assertPreviewMatchesShots, loadShotChampions, rowIndexOf, uploadShots } from '../../support/vision';

// Covers the champion picker, frontend-only behaviour the unit tests cannot reach:
// this spec is the only thing standing between a re-diff bug and the roster.
describe('Roster – Vision correction', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('re-diffs the row when the champion is corrected from Kindred to Mordo', () => {
    setupRosterUser('vision-margin-rediff', 'ReDiffPlayer').then(({ adminData, userData, accountId }) => {
      // Mordo, Mystic like Kindred, is owned at 7r3 — below the 7r4 shot_0001 reads for
      // Kindred — so the correction must diff against 7r3, not treat the row as new.
      loadShotChampions(adminData.access_token, ['shot_0001.png'], ['Mordo']).then((champs) => {
        cy.apiAddChampionToRoster(userData.access_token, accountId, champs['Mordo'].id, '7r3');
      });

      cy.apiLogin(userData.user_id, 'roster');

      uploadShots('shot_0001.png');
      assertPreviewMatchesShots(['shot_0001.png']);

      rowIndexOf('Kindred').then((i) => {
        // Read as Kindred, which is not owned: starts "new".
        cy.getByCy(`preview-row-status-badge-${i}`).should('have.attr', 'data-status', 'new');

        cy.getByCy(`preview-row-champion-trigger-${i}`).click();
        cy.getByCy(`preview-row-catalog-${i}-Mordo`).click();

        // A missed re-diff (isNew/oldRarity computed against the wrong champion)
        // would leave this "new" — exactly the bug this row exists to catch.
        cy.getByCy(`preview-row-status-badge-${i}`).should('have.attr', 'data-status', 'updated');
        cy.getByCy(`preview-row-score-badge-${i}`).should('have.attr', 'data-level', 'corrected');
      });
    });
  });
});
