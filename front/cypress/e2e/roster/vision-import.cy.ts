import { setupRosterUser } from '../../support/e2e';

// This spec proves the full vision import loop:
// front -> API -> RabbitMQ -> worker -> API -> preview -> confirm -> roster.
//
// It requires the model-free `fake-vision-worker` (Task 13) to be running,
// consuming the SAME `vision.jobs` queue as the real `vision-worker`. CI must
// start it with `docker compose -f compose-dev.yaml --profile e2e up -d
// fake-vision-worker` before this spec runs, and the real `vision-worker`
// must NOT be running at the same time — both consume the same queue, so
// running both makes message delivery non-deterministic.
//
// The fake worker returns two deterministic predictions (see fake-worker/main.py):
//   - Hulk, Science, 7 stars, rank 3, sig 200, ascension 1, confidence 0.91
//   - Iron Man, Tech, 6 stars, rank 5, sig 0, ascension 0, confidence 0.42
// crop_key is always null, so the review row falls back to <ChampionPortrait>
// instead of rendering a crop thumbnail.
//
// Row order across the two predictions of a single screenshot is not
// guaranteed (VisionPrediction primary keys are random UUIDs, and the API
// orders by id) — the spec locates each row by its known signature value
// instead of assuming a fixed index.
describe('Roster – Vision Import (E2E, fake worker)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('imports a roster screenshot end-to-end through the fake vision worker', () => {
    setupRosterUser('vision-import', 'VisionPlayer').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'Hulk', 'Science');
      cy.apiLoadChampion(adminData.access_token, 'Iron Man', 'Tech');

      cy.apiLogin(userData.user_id);
      cy.navTo('roster');

      cy.getByCy('import-vision-button').click();
      cy.get('[data-cy=vision-input]').selectFile('cypress/fixtures/vision/sample-roster.png', {
        force: true,
      });

      // The preview opens once the fake worker has published its result and
      // the frontend has polled it — give it generous time for the broker
      // round trip.
      cy.getByCy('preview-row-confidence-badge-0', { timeout: 30000 }).should('be.visible');
      cy.getByCy('preview-row-confidence-badge-1').should('be.visible');

      // Neither row has a crop (crop_key is null on both fixture
      // predictions) — assert the ChampionPortrait fallback, not a crop image.
      cy.getByCy('preview-row-crop-0').should('not.exist');
      cy.getByCy('preview-row-crop-1').should('not.exist');

      // Locate Hulk/Iron Man by their known signature (200 vs 0) instead of a
      // fixed index, since row order between the two predictions of one
      // screenshot is not guaranteed.
      cy.getByCy('preview-row-signature-input-0')
        .invoke('val')
        .then((val0) => {
          const hulkIndex = String(val0) === '200' ? 0 : 1;
          const ironManIndex = hulkIndex === 0 ? 1 : 0;

          // Hulk row: high confidence (0.91 >= 0.75) renders green, editable fields
          // reflect the prediction, portrait fallback is used (no crop).
          cy.getByCy(`preview-row-confidence-badge-${hulkIndex}`).should('have.class', 'bg-green-600');
          cy.getByCy(`champion-portrait-Hulk-normal`).should('exist');
          cy.getByCy(`preview-row-signature-input-${hulkIndex}`).should('have.value', '200');
          cy.getByCy(`preview-row-ascension-input-${hulkIndex}`).should('have.value', '1');

          // Iron Man row: low confidence (0.42 < 0.5) renders red.
          cy.getByCy(`preview-row-confidence-badge-${ironManIndex}`).should('have.class', 'bg-red-600');
          cy.getByCy(`champion-portrait-Iron Man-normal`).should('exist');
          cy.getByCy(`preview-row-signature-input-${ironManIndex}`).should('have.value', '0');

          // Prove the row is editable: correct Hulk's signature.
          cy.getByCy(`preview-row-signature-input-${hulkIndex}`).type('{selectall}250');
          cy.getByCy(`preview-row-signature-input-${hulkIndex}`).should('have.value', '250');
        });

      // Opt into contributing the corrected rows to the training dataset.
      cy.getByCy('import-share-dataset-checkbox').click();
      cy.getByCy('import-share-dataset-checkbox').should('have.attr', 'data-state', 'checked');

      // Confirm the import — writes the roster and closes the preview.
      cy.getByCy('import-preview-confirm-button').click();

      // The report dialog opens automatically; close it to get back to the roster.
      cy.getByCy('import-report-close-button', { timeout: 15000 }).click();

      // The roster now contains Hulk with the corrected signature.
      cy.getByCy('champion-card-Hulk').should('exist');
      cy.getByCy('champion-card-Hulk').find('[data-cy="champion-sig"]').should('contain', 'sig 250');
    });
  });
});
