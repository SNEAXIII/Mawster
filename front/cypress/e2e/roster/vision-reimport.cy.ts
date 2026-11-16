import { setupRosterUser } from '../../support/e2e';
import { assertPreviewMatchesShots, loadShotChampions, uploadShots } from '../../support/vision';

// Re-reading a screenshot already imported finds nothing new: every row is unchanged,
// so the import button has nothing to send and stays disabled.
describe('Roster – Vision re-import of the same screenshot', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('disables the import once the screenshot is already in the roster', () => {
    setupRosterUser('vision-reimport', 'ReimportPlayer').then(({ adminData, userData }) => {
      loadShotChampions(adminData.access_token, ['shot_0001.png']);
      cy.apiLogin(userData.user_id, 'roster');

      uploadShots('shot_0001.png');
      assertPreviewMatchesShots(['shot_0001.png']);
      cy.getByCy('import-preview-confirm-button').should('be.enabled').click();
      cy.getByCy('import-report-close-button').click();

      for (let attempt = 2; attempt <= 3; attempt++) {
        uploadShots('shot_0001.png');
        assertPreviewMatchesShots(['shot_0001.png']);
        cy.get('[data-cy^="preview-row-status-badge-"]').should(($badges) => {
          expect([...$badges].map((b) => b.dataset.status)).to.deep.equal(Array($badges.length).fill('unchanged'));
        });
        cy.getByCy('import-preview-confirm-button').should('be.disabled');
        cy.get('body').type('{esc}');
        cy.getByCy('import-preview-confirm-button').should('not.exist');
      }
    });
  });
});
