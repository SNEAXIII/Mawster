import { setupUser } from '../../support/e2e';

describe('Game Accounts – UI', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Basic rendering
  // =========================================================================

  it('shows the game accounts section on the profile page', () => {
    setupUser('ga-section-token').then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo('profile');
      cy.contains('Game Accounts').should('be.visible');
    });
  });

  it('shows empty state when no accounts exist', () => {
    setupUser('ga-empty-token').then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo('profile');
      cy.contains('No game accounts yet').scrollIntoView().should('be.visible');
    });
  });

  // =========================================================================
  // Create
  // =========================================================================

  it('creates a game account via the profile form', () => {
    setupUser('ga-create-token').then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo('profile');

      cy.getByCy('account-pseudo-input').scrollIntoView().type('MyGamePseudo');
      cy.getByCy('account-create-btn').click();

      cy.contains('MyGamePseudo').scrollIntoView().should('be.visible');
      cy.contains('Game account created successfully').should('be.visible');
    });
  });

  it('shows the Primary badge on the first created account', () => {
    setupUser('ga-primary-token').then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo('profile');

      cy.getByCy('account-pseudo-input').scrollIntoView().type('PrimaryPlayer');
      cy.getByCy('account-create-btn').click();

      cy.contains('PrimaryPlayer').scrollIntoView().should('be.visible');
      cy.contains('Primary').should('be.visible');
    });
  });

  it('displays account count', () => {
    setupUser('ga-count-token').then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'Account1', true);
      cy.apiCreateGameAccount(access_token, 'Account2', false);

      cy.uiLogin(login);
      cy.navTo('profile');
      cy.contains('2/10 accounts').scrollIntoView().should('be.visible');
    });
  });

  // =========================================================================
  // Edit
  // =========================================================================

  it('edits a game account pseudo via the pencil icon', () => {
    setupUser('ga-edit-token').then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'OldPseudo', true);

      cy.uiLogin(login);
      cy.navTo('profile');
      cy.contains('OldPseudo').scrollIntoView().should('be.visible');

      cy.getByCy('account-row-OldPseudo')
        .find('[data-cy="account-edit-btn-0"]')
        .click({ force: true });

      cy.get('input[maxlength="16"]').clear().type('NewPseudo');
      cy.getByCy('account-edit-confirm').first().click({ force: true });

      cy.contains('Game account renamed successfully').should('be.visible');
      cy.contains('NewPseudo').scrollIntoView().should('be.visible');
    });
  });

  // =========================================================================
  // Delete
  // =========================================================================

  it('deletes a game account with confirmation dialog', () => {
    setupUser('ga-delete-token').then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'ToDelete', true);

      cy.uiLogin(login);
      cy.navTo('profile');
      cy.contains('ToDelete').scrollIntoView().should('be.visible');

      cy.getByCy('account-row-ToDelete')
        .find('[data-cy="account-delete-btn"]')
        .click({ force: true });

      cy.get('[role="alertdialog"]').should('be.visible');
      cy.get('[role="alertdialog"]').contains('button', 'Delete').click();

      cy.contains('Game account deleted successfully').should('be.visible');
      cy.contains('ToDelete').should('not.exist');
    });
  });

  // =========================================================================
  // Primary management
  // =========================================================================

  it('sets the primary account', () => {
    setupUser('ga-setprim-token').then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'Account1', true);
      cy.apiCreateGameAccount(access_token, 'Account2', false);

      cy.uiLogin(login);
      cy.navTo('profile');
      cy.getByCy('account-row-Account1')
        .scrollIntoView()
        .find('[data-cy="account-primary-badge"]')
        .should('exist');
      cy.getByCy('account-row-Account2')
        .scrollIntoView()
        .find('[data-cy="account-primary-badge"]')
        .should('not.exist');

      cy.getByCy('account-star-btn-1').click();

      cy.getByCy('account-row-Account2')
        .scrollIntoView()
        .find('[data-cy="account-primary-badge"]')
        .should('exist');
      cy.getByCy('account-row-Account1')
        .scrollIntoView()
        .find('[data-cy="account-primary-badge"]')
        .should('not.exist');
    });
  });

  it('create new account does not steal primary from the first', () => {
    setupUser('ga-newprim-token').then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'MainAccount', true);

      cy.uiLogin(login);
      cy.navTo('profile');

      cy.getByCy('collapsible-add-a-game-account').scrollIntoView().click();
      cy.getByCy('account-pseudo-input').scrollIntoView().type('SecondAccount');
      cy.getByCy('account-create-btn').click();

      cy.contains('SecondAccount').scrollIntoView().should('be.visible');

      cy.getByCy('account-row-MainAccount')
        .scrollIntoView()
        .find('[data-cy="account-primary-badge"]')
        .should('exist');
      cy.getByCy('account-row-SecondAccount')
        .scrollIntoView()
        .find('[data-cy="account-primary-badge"]')
        .should('not.exist');

      // Switch primary to SecondAccount
      cy.getByCy('account-star-btn-1').click();

      cy.getByCy('account-row-SecondAccount')
        .scrollIntoView()
        .find('[data-cy="account-primary-badge"]')
        .should('exist');
      cy.getByCy('account-row-MainAccount')
        .scrollIntoView()
        .find('[data-cy="account-primary-badge"]')
        .should('not.exist');
    });
  });
});
