import { setupRosterUser } from '../../support/e2e';

// Covers the champion picker, frontend-only behaviour the unit tests cannot reach:
// this spec is the only thing standing between a re-diff bug and the roster.
//
// Fixture: the fake vision worker (fake-worker/main.py) always returns two
// predictions for any uploaded screenshot — Hulk and Iron Man. Row order
// across the two predictions of one screenshot
// is NOT guaranteed (VisionPrediction primary keys are random UUIDs and the
// API orders by id) — rows are located by signature (200 vs 0), not index.
describe('Roster – Vision correction', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // Locates a preview row by its (unique) signature value rather than its
  // array index, since the two predictions of one screenshot are not
  // guaranteed to come back in a stable order.
  function findRowIndexBySignature(signature: number): Cypress.Chainable<number> {
    return cy
      .get('[data-cy^="preview-row-signature-input-"]', { timeout: 30000 })
      .should('have.length', 2)
      .then(($inputs) => {
        const match = [...$inputs].find((input) => Number((input as HTMLInputElement).value) === signature);
        if (!match) {
          throw new Error(`No preview row found with signature ${signature}`);
        }
        const dataCy = match.getAttribute('data-cy') ?? '';
        return Number(dataCy.replace('preview-row-signature-input-', ''));
      });
  }

  function uploadFixtureScreenshot() {
    // The file input is visually hidden (class='hidden'), so selectFile cannot
    // wait for it to be actionable — force is the only way to attach a fixture.
    cy.get('[data-cy="vision-input"]').selectFile('cypress/fixtures/vision/sample-roster.png', {
      force: true,
    });
  }

  it('re-diffs the row when the champion is corrected from Iron Man to War Machine', () => {
    setupRosterUser('vision-margin-rediff', 'ReDiffPlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Hulk', 'Science');
      cy.apiLoadChampion(adminData.access_token, 'Iron Man', 'Tech');
      // War Machine is already owned, at a rarity distinct from Iron Man's
      // predicted 6r5 — the correction must diff against 6r4, not treat
      // the row as new.
      cy.apiLoadChampion(adminData.access_token, 'War Machine', 'Tech').then((champs) => {
        const warMachineId = (champs as { id: string }[])[0].id;
        cy.apiAddChampionToRoster(userData.access_token, accountId, warMachineId, '6r4');
      });

      cy.apiLogin(userData.user_id, 'roster');

      uploadFixtureScreenshot();

      findRowIndexBySignature(0).then((ironManIndex) => {
        // Read as Iron Man, which is not owned: starts "new".
        cy.getByCy(`preview-row-status-badge-${ironManIndex}`).should('have.attr', 'data-status', 'new');

        cy.getByCy(`preview-row-champion-trigger-${ironManIndex}`).click();
        cy.getByCy(`preview-row-catalog-${ironManIndex}-War Machine`).click();

        // Corrected to War Machine, which IS owned at a different rarity:
        // the re-diff must flip this to "updated", not leave it "new".
        // A missed re-diff (isNew/oldRarity computed against the wrong
        // champion) is exactly the bug this row exists to catch.
        cy.getByCy(`preview-row-status-badge-${ironManIndex}`).should('have.attr', 'data-status', 'updated');
        cy.getByCy(`preview-row-score-badge-${ironManIndex}`).should('have.attr', 'data-level', 'corrected');
      });
    });
  });
});
