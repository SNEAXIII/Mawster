/// <reference types="cypress" />

import { TEST_GAME_ACCOUNT, TEST_CHAMPIONS } from '../support/commands';

/**
 * E2E tests for the Roster page.
 * Verifies champion add/update, roster display, upgrade, delete, and import/export.
 */
describe('Roster Page', () => {
  const rosterEntries = [
    {
      id: 'ru-001',
      game_account_id: 'ga-001',
      champion_id: 'champ-001',
      rarity: '7r3',
      signature: 200,
      champion_name: 'Spider-Man',
      champion_class: 'Science',
      image_url: null,
      is_preferred_attacker: false,
    },
    {
      id: 'ru-002',
      game_account_id: 'ga-001',
      champion_id: 'champ-002',
      rarity: '6r5',
      signature: 100,
      champion_name: 'Doctor Doom',
      champion_class: 'Mystic',
      image_url: null,
      is_preferred_attacker: true,
    },
  ];

  beforeEach(() => {
    cy.mockSession();
    cy.setLocale('en');
    cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);
    cy.stubApi('GET', 'alliances/my-roles', { roles: {}, my_account_ids: ['ga-001'] });
  });

  // ─── Display ─────────────────────────────────────────

  describe('Display', () => {
    it('shows the page title', () => {
      cy.stubApi('GET', `champion-users/by-account/${TEST_GAME_ACCOUNT.id}`, rosterEntries);
      cy.stubApi('GET', 'champion-users/upgrade-requests/by-account/*', []);
      cy.visit('/game/roster');

      cy.contains('My Roster').should('be.visible');
    });

    it('displays roster entries grouped by rarity', () => {
      cy.stubApi('GET', `champion-users/by-account/${TEST_GAME_ACCOUNT.id}`, rosterEntries);
      cy.stubApi('GET', 'champion-users/upgrade-requests/by-account/*', []);
      cy.visit('/game/roster');

      cy.contains('Spider-Man').should('be.visible');
      cy.contains('Doctor Doom').should('be.visible');
    });

    it('shows empty state when roster is empty', () => {
      cy.stubApi('GET', `champion-users/by-account/${TEST_GAME_ACCOUNT.id}`, []);
      cy.stubApi('GET', 'champion-users/upgrade-requests/by-account/*', []);
      cy.visit('/game/roster');

      cy.contains('Your roster is empty').should('be.visible');
    });

    it('shows preferred attacker indicator', () => {
      cy.stubApi('GET', `champion-users/by-account/${TEST_GAME_ACCOUNT.id}`, rosterEntries);
      cy.stubApi('GET', 'champion-users/upgrade-requests/by-account/*', []);
      cy.visit('/game/roster');

      // Preferred attacker is indicated with a ⚔ emoji before the name
      cy.contains('⚔').should('be.visible');
    });
  });

  // ─── Add champion ───────────────────────────────────

  describe('Add champion', () => {
    it('shows the add champion form', () => {
      cy.stubApi('GET', `champion-users/by-account/${TEST_GAME_ACCOUNT.id}`, []);
      cy.stubApi('GET', 'champion-users/upgrade-requests/by-account/*', []);
      cy.visit('/game/roster');

      cy.contains('Add / Update a Champion').should('be.visible');
      cy.get('input[placeholder="Search a champion..."]').should('be.visible');
    });

    it('searches for a champion and selects it', () => {
      cy.stubApi('GET', `champion-users/by-account/${TEST_GAME_ACCOUNT.id}`, []);
      cy.stubApi('GET', 'champion-users/upgrade-requests/by-account/*', []);
      cy.visit('/game/roster');

      // Stub champion search
      cy.intercept('GET', '/api/back/admin/champions*search=Spider*', {
        statusCode: 200,
        body: {
          champions: [TEST_CHAMPIONS[0]],
          total_champions: 1,
          total_pages: 1,
          current_page: 1,
        },
      });

      cy.get('input[placeholder="Search a champion..."]').type('Spider');

      // Wait for search results
      cy.contains('Spider-Man').should('be.visible');
    });

    it('adds a champion to the roster', () => {
      cy.stubApi('GET', `champion-users/by-account/${TEST_GAME_ACCOUNT.id}`, []);
      cy.stubApi('GET', 'champion-users/upgrade-requests/by-account/*', []);
      cy.visit('/game/roster');

      // Stub champion search
      cy.intercept('GET', '/api/back/admin/champions*', {
        statusCode: 200,
        body: {
          champions: [TEST_CHAMPIONS[0]],
          total_champions: 1,
          total_pages: 1,
          current_page: 1,
        },
      });

      const newEntry = {
        id: 'ru-new',
        game_account_id: 'ga-001',
        champion_id: 'champ-001',
        rarity: '7r1',
        signature: 50,
        champion_name: 'Spider-Man',
        champion_class: 'Science',
        image_url: null,
        is_preferred_attacker: false,
      };

      cy.stubApi('POST', 'champion-users', newEntry, 201);
      cy.intercept('GET', `/api/back/champion-users/by-account/${TEST_GAME_ACCOUNT.id}`, {
        statusCode: 200,
        body: [newEntry],
      });

      cy.get('input[placeholder="Search a champion..."]').type('Spider');
      cy.contains('Spider-Man').click();

      cy.contains('Add / Update').click();

      cy.waitForToast('added / updated');
    });
  });

  // ─── Delete champion ────────────────────────────────

  describe('Delete champion from roster', () => {
    it('shows confirmation dialog', () => {
      cy.stubApi('GET', `champion-users/by-account/${TEST_GAME_ACCOUNT.id}`, rosterEntries);
      cy.stubApi('GET', 'champion-users/upgrade-requests/by-account/*', []);
      cy.visit('/game/roster');

      // Click delete on a roster entry (button has title="Delete")
      cy.contains('Spider-Man')
        .closest('.group')
        .find('button[title="Delete"]')
        .first()
        .click({ force: true });

      cy.contains('Remove from roster').should('be.visible');
    });
  });

  // ─── Import/Export ──────────────────────────────────

  describe('Import and Export', () => {
    it('shows import and export buttons', () => {
      cy.stubApi('GET', `champion-users/by-account/${TEST_GAME_ACCOUNT.id}`, rosterEntries);
      cy.stubApi('GET', 'champion-users/upgrade-requests/by-account/*', []);
      cy.visit('/game/roster');

      cy.contains('Export JSON').should('be.visible');
      cy.contains('Import JSON').should('be.visible');
    });
  });

  // ─── Account selector ──────────────────────────────

  describe('Account selector', () => {
    it('shows message when no game accounts exist', () => {
      cy.stubApi('GET', 'game-accounts', []);
      cy.visit('/game/roster');

      cy.contains('You need to create a game account first').should('be.visible');
    });
  });

  // ─── Upgrade requests ──────────────────────────────

  describe('Upgrade requests', () => {
    it('shows upgrade requests section', () => {
      const upgradeRequests = [
        {
          id: 'ur-001',
          champion_user_id: 'ru-001',
          requester_game_account_id: 'ga-ext',
          requester_pseudo: 'OtherPlayer',
          requested_rarity: '7r4',
          current_rarity: '7r3',
          champion_name: 'Spider-Man',
          champion_class: 'Science',
          image_url: null,
          created_at: '2024-04-01T10:00:00Z',
          done_at: null,
        },
      ];

      cy.stubApi('GET', `champion-users/by-account/${TEST_GAME_ACCOUNT.id}`, rosterEntries);
      cy.stubApi('GET', 'champion-users/upgrade-requests/by-account/*', upgradeRequests);
      cy.visit('/game/roster');

      cy.contains('Upgrade Requests').should('be.visible');
      cy.contains('OtherPlayer').should('be.visible');
    });

    it('shows empty state for upgrade requests', () => {
      cy.stubApi('GET', `champion-users/by-account/${TEST_GAME_ACCOUNT.id}`, rosterEntries);
      cy.stubApi('GET', 'champion-users/upgrade-requests/by-account/*', []);
      cy.visit('/game/roster');

      cy.contains('No pending upgrade requests').should('be.visible');
    });
  });

  // ─── Navigation ──────────────────────────────────────

  describe('Navigation', () => {
    it('navigates to roster from sidebar', () => {
      cy.stubApi('GET', `champion-users/by-account/${TEST_GAME_ACCOUNT.id}`, []);
      cy.stubApi('GET', 'champion-users/upgrade-requests/by-account/*', []);
      cy.visit('/');
      cy.contains('Roster').click();
      cy.url().should('include', '/game/roster');
    });
  });
});
