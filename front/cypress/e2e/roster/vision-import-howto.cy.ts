import { setupRosterUser, confirmAction } from '../../support/e2e';
import { assertPreviewMatchesShots, loadShotChampions, uploadShots } from '../../support/vision';

// The how-to dialog is pure frontend behaviour, and this project has no
// frontend unit tests by design — this spec is the only thing keeping the
// dialog wired between the button and the file picker.
describe('Roster – Vision import how-to dialog', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  function visitRoster(prefix: string, pseudo: string) {
    return setupRosterUser(prefix, pseudo).then((data) => {
      cy.apiLogin(data.userData.user_id, 'roster');
      return cy.wrap(data);
    });
  }

  it('explains the procedure before opening the file picker', () => {
    visitRoster('vision-howto', 'HowtoPlayer');

    // The picker input is always in the DOM — spying on its click proves
    // the dialog's confirm actually opens the file picker, not just that
    // the dialog itself closes.
    cy.get('[data-cy="vision-input"]').then(($el) => {
      cy.spy($el[0], 'click').as('picker');
    });

    cy.getByCy('import-vision-button').click();
    cy.getByCy('vision-import-howto-dialog').should('be.visible');
    cy.getByCy('confirmation-dialog-confirm').click();
    cy.getByCy('vision-import-howto-dialog').should('not.exist');
    cy.get('@picker').should('have.been.calledOnce');
  });

  it('shows the dialog again on every import', () => {
    visitRoster('vision-howto-again', 'AgainPlayer');

    cy.getByCy('import-vision-button').click();
    cy.getByCy('confirmation-dialog-confirm').click();
    cy.getByCy('import-vision-button').click();
    cy.getByCy('vision-import-howto-dialog').should('be.visible');
  });

  it('still reads the screenshot once the dialog is confirmed', () => {
    setupRosterUser('vision-howto-import', 'ImportPlayer').then(({ adminData, userData }) => {
      loadShotChampions(adminData.access_token, ['shot_0001.png']);
      cy.apiLogin(userData.user_id, 'roster');

      confirmAction('import-vision-button');
      uploadShots('shot_0001.png');
      assertPreviewMatchesShots(['shot_0001.png']);
    });
  });

  it('reads a full screen of 48 cards', () => {
    setupRosterUser('vision-full-screen', 'FullScreenPlayer').then(({ adminData, userData }) => {
      loadShotChampions(adminData.access_token, ['shot_0004.png']);
      cy.apiLogin(userData.user_id, 'roster');

      uploadShots('shot_0004.png');
      assertPreviewMatchesShots(['shot_0004.png']);
    });
  });

  it('reads several screenshots uploaded together as one batch', () => {
    setupRosterUser('vision-batch', 'BatchPlayer').then(({ adminData, userData }) => {
      const batch = ['shot_0065.jpg', 'shot_0066.jpg', 'shot_0067.jpg', 'shot_0068.jpg'];
      loadShotChampions(adminData.access_token, batch);
      cy.apiLogin(userData.user_id, 'roster');

      uploadShots(...batch);
      // Shang-Chi, Nick Fury and Quicksilver show twice, at two star levels: both rows stay.
      assertPreviewMatchesShots(batch);
    });
  });
});
