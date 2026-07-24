import { setupRosterUser } from '../../support/e2e';

// The how-to dialog is pure frontend behaviour, and this project has no
// frontend unit tests by design — this spec is the only thing keeping the
// dialog wired between the button and the file picker.
describe('Roster – Vision import how-to dialog', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  function visitRoster(prefix: string, pseudo: string) {
    return setupRosterUser(prefix, pseudo).then((data) => {
      cy.apiLogin(data.userData.user_id);
      cy.navTo('roster');
      return cy.wrap(data);
    });
  }

  it('explains the procedure before opening the file picker', () => {
    visitRoster('vision-howto', 'HowtoPlayer');

    cy.getByCy('import-vision-button').click();
    cy.getByCy('vision-import-howto-dialog').should('be.visible');
    cy.getByCy('confirmation-dialog-confirm').click();
    cy.getByCy('vision-import-howto-dialog').should('not.exist');
  });

  it('stops showing the dialog once "do not show again" is ticked', () => {
    visitRoster('vision-howto-optout', 'OptoutPlayer');

    cy.getByCy('import-vision-button').click();
    cy.getByCy('vision-howto-dont-show').click();
    cy.getByCy('confirmation-dialog-confirm').click();
    cy.getByCy('vision-import-howto-dialog').should('not.exist');

    // Second click goes straight to the (native, invisible) file picker.
    cy.getByCy('import-vision-button').click();
    cy.getByCy('vision-import-howto-dialog').should('not.exist');
  });

  it('reopens the dialog from the help icon, even after opting out', () => {
    visitRoster('vision-howto-help', 'HelpPlayer');

    cy.getByCy('import-vision-button').click();
    cy.getByCy('vision-howto-dont-show').click();
    cy.getByCy('confirmation-dialog-confirm').click();

    cy.getByCy('vision-howto-help').click();
    cy.getByCy('vision-import-howto-dialog').should('be.visible');
    // The help icon informs only: dismissing it must not start an import.
    cy.getByCy('confirmation-dialog-cancel').click();
    cy.getByCy('vision-import-howto-dialog').should('not.exist');
  });

  it('still reads the screenshot once the dialog is confirmed', () => {
    visitRoster('vision-howto-import', 'ImportPlayer').then(({ adminData }) => {
      cy.apiLoadChampion(adminData.access_token, 'Hulk', 'Science');
      cy.apiLoadChampion(adminData.access_token, 'Iron Man', 'Tech');

      cy.getByCy('import-vision-button').click();
      cy.getByCy('confirmation-dialog-confirm').click();

      cy.get('[data-cy="vision-input"]').selectFile('cypress/fixtures/vision/sample-roster.png', {
        force: true,
      });

      cy.get('[data-cy^="preview-row-signature-input-"]', { timeout: 30000 }).should('have.length', 2);
    });
  });
});
