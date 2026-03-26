import { setupUser } from '../support/e2e';

describe('Mobile Settings Sheet', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows the settings button on mobile and on desktop', () => {
    setupUser('modal-settings-visibility').then(({ user_id }) => {
      cy.apiLogin(user_id);

      // Mobile: button should be visible
      cy.viewport(375, 667);
      cy.getByCy('modal-settings-trigger').should('be.visible');

      // Desktop: button should be visible
      cy.viewport(1280, 800);
      cy.getByCy('modal-settings-trigger').should('be.visible');
    });
  });

  it('opens the settings sheet when the button is clicked on mobile', () => {
    setupUser('modal-settings-open').then(({ user_id }) => {
      cy.viewport(375, 667);
      cy.apiLogin(user_id);

      cy.getByCy('modal-settings-trigger').click();
      cy.getByCy('modal-settings-content').should('be.visible');
      cy.contains('Settings').should('be.visible');
      cy.contains('Language').should('be.visible');
      cy.contains('Theme').should('be.visible');
    });
  });

  it('toggles language from EN to FR via the settings sheet', () => {
    setupUser('modal-settings-lang').then(({ user_id }) => {
      cy.viewport(375, 667);
      cy.apiLogin(user_id);

      // Open settings sheet
      cy.getByCy('modal-settings-trigger').click();
      cy.getByCy('modal-settings-content').should('be.visible');

      // Initially EN — flag shows FR (next language)
      cy.getByCy('modal-settings-content').within(() => {
        cy.contains('🇫🇷').click();
      });

      // Page should now show French content
      cy.contains('Paramètres').should('be.visible');
    });
  });

  it('signs out when the sign out button is clicked', () => {
    setupUser('modal-settings-signout').then(({ user_id }) => {
      cy.apiLogin(user_id);
      cy.navTo('profile');

      cy.getByCy('modal-settings-trigger').click();
      cy.getByCy('modal-settings-content').should('be.visible');
      cy.getByCy('modal-settings-sign-out').click();

      cy.url().should('include', '/login?callbackUrl=%2Fprofile');
    });
  });

  it('toggles theme via the settings sheet', () => {
    setupUser('modal-settings-theme').then(({ user_id }) => {
      cy.viewport(375, 667);
      cy.apiLogin(user_id);

      // Open settings sheet
      cy.getByCy('modal-settings-trigger').click();
      cy.getByCy('modal-settings-content').should('be.visible');

      // Click the theme toggle button inside the sheet
      cy.getByCy('modal-settings-content').within(() => {
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
