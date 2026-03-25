import { setupUser } from '../support/e2e';

describe('Mobile Settings Sheet', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows the settings button on mobile and hides it on desktop', () => {
    setupUser('mobile-settings-visibility').then(({ login }) => {
      cy.uiLogin(login);

      // Mobile: button should be visible
      cy.viewport(375, 667);
      cy.getByCy('mobile-settings-trigger').should('be.visible');

      // Desktop: button should not be visible
      cy.viewport(1280, 800);
      cy.getByCy('mobile-settings-trigger').should('not.be.visible');
    });
  });

  it('opens the settings sheet when the button is clicked on mobile', () => {
    setupUser('mobile-settings-open').then(({ login }) => {
      cy.viewport(375, 667);
      cy.uiLogin(login);

      cy.getByCy('mobile-settings-trigger').click();
      cy.getByCy('mobile-settings-sheet').should('be.visible');
      cy.contains('Settings').should('be.visible');
      cy.contains('Language').should('be.visible');
      cy.contains('Theme').should('be.visible');
    });
  });

  it('toggles language from EN to FR via the settings sheet', () => {
    setupUser('mobile-settings-lang').then(({ login }) => {
      cy.viewport(375, 667);
      cy.uiLogin(login);

      // Open settings sheet
      cy.getByCy('mobile-settings-trigger').click();
      cy.getByCy('mobile-settings-sheet').should('be.visible');

      // Initially EN — flag shows FR (next language)
      cy.getByCy('mobile-settings-sheet').within(() => {
        cy.contains('🇫🇷').click();
      });

      // Page should now show French content
      cy.contains('Paramètres').should('be.visible');
    });
  });

  it('toggles theme via the settings sheet', () => {
    setupUser('mobile-settings-theme').then(({ login }) => {
      cy.viewport(375, 667);
      cy.uiLogin(login);

      // Open settings sheet
      cy.getByCy('mobile-settings-trigger').click();
      cy.getByCy('mobile-settings-sheet').should('be.visible');

      // Click the theme toggle button inside the sheet
      cy.getByCy('mobile-settings-sheet').within(() => {
        cy.get('button[aria-label]').last().click();
      });

      // Theme attribute should have changed on html element
      cy.get('html').then(($html) => {
        const cls = $html.attr('class') ?? '';
        expect(cls).to.satisfy((c: string) => c.includes('light') || c.includes('dark'));
      });
    });
  });
});
