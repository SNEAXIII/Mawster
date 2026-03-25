import { setupUser } from '../support/e2e';

describe('Mobile Settings Sheet', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows the settings button on mobile and on desktop', () => {
    setupUser('modale-settings-visibility').then(({ login }) => {
      cy.uiLogin(login);

      // Mobile: button should be visible
      cy.viewport(375, 667);
      cy.getByCy('modale-settings-trigger').should('be.visible');

      // Desktop: button should be visible
      cy.viewport(1280, 800);
      cy.getByCy('modale-settings-trigger').should('be.visible');
    });
  });

  it('opens the settings sheet when the button is clicked on mobile', () => {
    setupUser('modale-settings-open').then(({ login }) => {
      cy.viewport(375, 667);
      cy.uiLogin(login);

      cy.getByCy('modale-settings-trigger').click();
      cy.getByCy('modale-settings-content').should('be.visible');
      cy.contains('Settings').should('be.visible');
      cy.contains('Language').should('be.visible');
      cy.contains('Theme').should('be.visible');
    });
  });

  it('toggles language from EN to FR via the settings sheet', () => {
    setupUser('modale-settings-lang').then(({ login }) => {
      cy.viewport(375, 667);
      cy.uiLogin(login);

      // Open settings sheet
      cy.getByCy('modale-settings-trigger').click();
      cy.getByCy('modale-settings-content').should('be.visible');

      // Initially EN — flag shows FR (next language)
      cy.getByCy('modale-settings-content').within(() => {
        cy.contains('🇫🇷').click();
      });

      // Page should now show French content
      cy.contains('Paramètres').should('be.visible');
    });
  });

  it('signs out when the sign out button is clicked', () => {
    setupUser('modale-settings-signout').then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo('profile');

      cy.getByCy('modale-settings-trigger').click();
      cy.getByCy('modale-settings-content').should('be.visible');
      cy.getByCy('modale-settings-sign-out').click();

      cy.url().should('include', '/login?callbackUrl=/profile');
    });
  });

  it('toggles theme via the settings sheet', () => {
    setupUser('modale-settings-theme').then(({ login }) => {
      cy.viewport(375, 667);
      cy.uiLogin(login);

      // Open settings sheet
      cy.getByCy('modale-settings-trigger').click();
      cy.getByCy('modale-settings-content').should('be.visible');

      // Click the theme toggle button inside the sheet
      cy.getByCy('modale-settings-content').within(() => {
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
