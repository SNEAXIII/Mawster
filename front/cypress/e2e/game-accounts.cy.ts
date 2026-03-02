/// <reference types="cypress" />

import {
  TEST_GAME_ACCOUNT,
  TEST_GAME_ACCOUNT_2,
  type MockGameAccount,
} from '../support/commands';

/**
 * E2E tests for the Game Accounts page.
 * Verifies CRUD operations, inline editing, and account limits.
 */
describe('Game Accounts Page', () => {
  const accounts: MockGameAccount[] = [TEST_GAME_ACCOUNT, TEST_GAME_ACCOUNT_2];

  beforeEach(() => {
    cy.mockSession();
    cy.setLocale('en');
  });

  // ─── Display ─────────────────────────────────────────

  describe('Display', () => {
    it('shows the page title and description', () => {
      cy.stubApi('GET', 'game-accounts', accounts);
      cy.visit('/game/accounts');

      cy.contains('Game Accounts').should('be.visible');
      cy.contains('Manage your Marvel Contest of Champions game accounts').should('be.visible');
    });

    it('shows account count', () => {
      cy.stubApi('GET', 'game-accounts', accounts);
      cy.visit('/game/accounts');

      cy.contains('2/10 accounts').should('be.visible');
    });

    it('renders all game accounts', () => {
      cy.stubApi('GET', 'game-accounts', accounts);
      cy.visit('/game/accounts');

      cy.contains('MyHero42').should('be.visible');
      cy.contains('AltAccount').should('be.visible');
    });

    it('shows Primary badge on primary account', () => {
      cy.stubApi('GET', 'game-accounts', accounts);
      cy.visit('/game/accounts');

      cy.contains('Primary').should('be.visible');
    });

    it('shows alliance tag badge on allied account', () => {
      cy.stubApi('GET', 'game-accounts', accounts);
      cy.visit('/game/accounts');

      cy.contains('[TST]').should('be.visible');
    });

    it('shows empty state when no accounts', () => {
      cy.stubApi('GET', 'game-accounts', []);
      cy.visit('/game/accounts');

      cy.contains('No game accounts yet').should('be.visible');
    });
  });

  // ─── Create ──────────────────────────────────────────

  describe('Create account', () => {
    it('shows the create form', () => {
      cy.stubApi('GET', 'game-accounts', []);
      cy.visit('/game/accounts');

      cy.contains('Add a Game Account').should('be.visible');
      cy.get('input#pseudo').should('be.visible');
      cy.contains('Add account').should('be.visible');
    });

    it('creates a new game account successfully', () => {
      const newAccount: MockGameAccount = {
        id: 'ga-new',
        user_id: 'user-001',
        alliance_id: null,
        alliance_group: null,
        alliance_tag: null,
        alliance_name: null,
        game_pseudo: 'NewHero99',
        is_primary: false,
        created_at: new Date().toISOString(),
      };

      cy.stubApi('GET', 'game-accounts', []);
      cy.visit('/game/accounts');

      // Stub POST and subsequent GET refresh
      cy.stubApi('POST', 'game-accounts', newAccount, 201);
      cy.intercept('GET', '/api/back/game-accounts', {
        statusCode: 200,
        body: [newAccount],
      });

      cy.get('input#pseudo').type('NewHero99');
      cy.contains('Add account').click();

      cy.waitForToast('Game account created successfully!');
      cy.contains('NewHero99').should('be.visible');
    });

    it('creates a primary game account', () => {
      const primaryAccount: MockGameAccount = {
        ...TEST_GAME_ACCOUNT,
        id: 'ga-primary-new',
        game_pseudo: 'PrimaryHero',
        is_primary: true,
      };

      cy.stubApi('GET', 'game-accounts', []);
      cy.visit('/game/accounts');

      cy.stubApi('POST', 'game-accounts', primaryAccount, 201);
      cy.intercept('GET', '/api/back/game-accounts', {
        statusCode: 200,
        body: [primaryAccount],
      });

      cy.get('input#pseudo').type('PrimaryHero');
      cy.get('input#is_primary').check();
      cy.contains('Add account').click();

      cy.waitForToast('Game account created successfully!');
    });

    it('disables create button when pseudo is empty', () => {
      cy.stubApi('GET', 'game-accounts', []);
      cy.visit('/game/accounts');

      cy.contains('Add account').should('be.disabled');
    });

    it('shows limit message when 10 accounts exist', () => {
      const tenAccounts = Array.from({ length: 10 }, (_, i) => ({
        ...TEST_GAME_ACCOUNT,
        id: `ga-${i}`,
        game_pseudo: `Hero${i}`,
        is_primary: i === 0,
      }));

      cy.stubApi('GET', 'game-accounts', tenAccounts);
      cy.visit('/game/accounts');

      cy.contains('Maximum of 10 game accounts reached').should('be.visible');
    });

    it('shows error toast on create failure', () => {
      cy.stubApi('GET', 'game-accounts', []);
      cy.visit('/game/accounts');

      cy.stubApi('POST', 'game-accounts', { detail: 'Server error' }, 500);

      cy.get('input#pseudo').type('FailHero');
      cy.contains('Add account').click();

      cy.waitForToast('Failed to create game account');
    });
  });

  // ─── Inline edit ─────────────────────────────────────

  describe('Inline edit', () => {
    it('enters edit mode on pencil click and shows input', () => {
      cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);
      cy.visit('/game/accounts');

      // Click the pencil (edit) button
      cy.get('button').find('svg.lucide-pencil').first().parent().click();

      // Should show an input with current pseudo
      cy.get('input[value="MyHero42"]').should('be.visible');
    });

    it('saves edited pseudo on confirm', () => {
      const updatedAccount = { ...TEST_GAME_ACCOUNT, game_pseudo: 'RenamedHero' };

      cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);
      cy.visit('/game/accounts');

      // Enter edit mode
      cy.get('button').find('svg.lucide-pencil').first().parent().click();

      // Stub the PUT and subsequent GET
      cy.stubApi('PUT', `game-accounts/${TEST_GAME_ACCOUNT.id}`, updatedAccount);
      cy.intercept('GET', '/api/back/game-accounts', {
        statusCode: 200,
        body: [updatedAccount],
      });

      cy.get('input[value="MyHero42"]').clear().type('RenamedHero');
      // Click the check (confirm) button
      cy.get('button').find('svg.lucide-check').first().parent().click();

      cy.waitForToast('Game account renamed successfully!');
    });

    it('cancels editing without saving', () => {
      cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);
      cy.visit('/game/accounts');

      cy.get('button').find('svg.lucide-pencil').first().parent().click();
      cy.get('input[value="MyHero42"]').clear().type('TempValue');

      // Click the X (cancel) button
      cy.get('button').find('svg.lucide-x').first().parent().click();

      // Original pseudo should still be shown
      cy.contains('MyHero42').should('be.visible');
    });
  });

  // ─── Delete ──────────────────────────────────────────

  describe('Delete account', () => {
    it('shows confirmation dialog before deleting', () => {
      cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);
      cy.visit('/game/accounts');

      // Click the trash button
      cy.get('button').find('svg.lucide-trash-2').first().parent().click();

      cy.contains('Are you sure you want to delete this game account?').should('be.visible');
      cy.contains('Delete').should('be.visible');
      cy.contains('Cancel').should('be.visible');
    });

    it('deletes account on confirm', () => {
      cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);
      cy.visit('/game/accounts');

      // Wait for initial data to render before setting up post-delete stubs
      cy.contains('MyHero42').should('be.visible');

      cy.stubApi('DELETE', `game-accounts/${TEST_GAME_ACCOUNT.id}`, null, 204);
      cy.intercept('GET', '/api/back/game-accounts', {
        statusCode: 200,
        body: [],
      });

      cy.get('button').find('svg.lucide-trash-2').first().parent().click();

      // Confirm in dialog
      cy.get('[role="alertdialog"]').contains('Delete').click();

      cy.waitForToast('Game account deleted successfully!');
      cy.contains('No game accounts yet').should('be.visible');
    });

    it('cancels deletion from dialog', () => {
      cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);
      cy.visit('/game/accounts');

      cy.get('button').find('svg.lucide-trash-2').first().parent().click();

      cy.get('[role="alertdialog"]').contains('Cancel').click();

      // Account should still be visible
      cy.contains('MyHero42').should('be.visible');
    });
  });

  // ─── Navigation ──────────────────────────────────────

  describe('Navigation', () => {
    it('navigates to game accounts from sidebar', () => {
      cy.stubApi('GET', 'game-accounts', []);
      cy.visit('/');
      cy.contains('Game Accounts').click();
      cy.url().should('include', '/game/accounts');
    });
  });
});
