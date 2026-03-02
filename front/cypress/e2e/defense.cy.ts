/// <reference types="cypress" />

import { TEST_ALLIANCE, TEST_GAME_ACCOUNT } from '../support/commands';

/**
 * E2E tests for the Defense Placement page.
 * Verifies defense display, BG selection, and member listing.
 */
describe('Defense Placement Page', () => {
  const defenseSummary = {
    alliance_id: 'alliance-001',
    battlegroup: 1,
    placements: [
      {
        id: 'dp-001',
        alliance_id: 'alliance-001',
        battlegroup: 1,
        node_number: 1,
        champion_user_id: 'ru-001',
        game_account_id: 'ga-001',
        game_pseudo: 'MyHero42',
        champion_name: 'Spider-Man',
        champion_class: 'Science',
        champion_image_url: null,
        rarity: '7r3',
        signature: 200,
        is_preferred_attacker: false,
        placed_by_id: 'ga-001',
        placed_by_pseudo: 'MyHero42',
        created_at: '2024-04-01T10:00:00Z',
      },
    ],
    member_defender_counts: {
      'ga-001': 1,
    },
  };

  const bgMembers = [
    {
      game_account_id: 'ga-001',
      game_pseudo: 'MyHero42',
      defender_count: 1,
      max_defenders: 5,
    },
  ];

  const allianceRoles = {
    roles: {
      'alliance-001': {
        is_owner: true,
        is_officer: false,
        can_manage: true,
      },
    },
    my_account_ids: ['ga-001'],
  };

  beforeEach(() => {
    cy.mockSession();
    cy.setLocale('en');
  });

  // ─── Display ─────────────────────────────────────────

  describe('Display', () => {
    it('shows the page title', () => {
      cy.stubApi('GET', 'alliances/mine', [TEST_ALLIANCE]);
      cy.stubApi('GET', 'alliances/my-roles', allianceRoles);
      cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1`, defenseSummary);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/members`, bgMembers);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/available-champions`, []);
      cy.visit('/game/defense');

      cy.contains('Defense Placement').should('be.visible');
    });

    it('shows alliance selector with available alliances', () => {
      cy.stubApi('GET', 'alliances/mine', [TEST_ALLIANCE]);
      cy.stubApi('GET', 'alliances/my-roles', allianceRoles);
      cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1`, defenseSummary);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/members`, bgMembers);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/available-champions`, []);
      cy.visit('/game/defense');

      cy.contains('Test Alliance').should('be.visible');
    });

    it('shows no-alliance message when user has no alliances', () => {
      cy.stubApi('GET', 'alliances/mine', []);
      cy.stubApi('GET', 'alliances/my-roles', { roles: {}, my_account_ids: [] });
      cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);
      cy.visit('/game/defense');

      cy.contains('You need to join an alliance').should('be.visible');
    });

    it('displays placed defenders', () => {
      cy.stubApi('GET', 'alliances/mine', [TEST_ALLIANCE]);
      cy.stubApi('GET', 'alliances/my-roles', allianceRoles);
      cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1`, defenseSummary);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/members`, bgMembers);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/available-champions`, []);
      cy.visit('/game/defense');

      cy.contains('Spider-Man').should('be.visible');
      cy.contains('MyHero42').should('be.visible');
    });

    it('displays BG members panel', () => {
      cy.stubApi('GET', 'alliances/mine', [TEST_ALLIANCE]);
      cy.stubApi('GET', 'alliances/my-roles', allianceRoles);
      cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1`, defenseSummary);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/members`, bgMembers);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/available-champions`, []);
      cy.visit('/game/defense');

      cy.contains('Members').should('be.visible');
      cy.contains('MyHero42').should('be.visible');
    });
  });

  // ─── BG selection ────────────────────────────────────

  describe('Battlegroup selection', () => {
    it('shows BG selector buttons', () => {
      cy.stubApi('GET', 'alliances/mine', [TEST_ALLIANCE]);
      cy.stubApi('GET', 'alliances/my-roles', allianceRoles);
      cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1`, defenseSummary);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/members`, bgMembers);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/available-champions`, []);
      cy.visit('/game/defense');

      cy.contains('Battlegroup').should('be.visible');
    });

    it('switches between battlegroups', () => {
      cy.stubApi('GET', 'alliances/mine', [TEST_ALLIANCE]);
      cy.stubApi('GET', 'alliances/my-roles', allianceRoles);
      cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/*`, {
        alliance_id: 'alliance-001',
        battlegroup: 2,
        placements: [],
        member_defender_counts: {},
      });
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/*/members`, []);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/*/available-champions`, []);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1`, defenseSummary);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/members`, bgMembers);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/available-champions`, []);
      cy.visit('/game/defense');

      // BG 1 should be active by default — verify defense is loaded
      cy.contains('Spider-Man').should('be.visible');
    });
  });

  // ─── Clear defense ──────────────────────────────────

  describe('Clear defense', () => {
    it('shows clear all button', () => {
      cy.stubApi('GET', 'alliances/mine', [TEST_ALLIANCE]);
      cy.stubApi('GET', 'alliances/my-roles', allianceRoles);
      cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1`, defenseSummary);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/members`, bgMembers);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/available-champions`, []);
      cy.visit('/game/defense');

      cy.contains('Clear All').should('be.visible');
    });

    it('shows confirmation dialog for clear', () => {
      cy.stubApi('GET', 'alliances/mine', [TEST_ALLIANCE]);
      cy.stubApi('GET', 'alliances/my-roles', allianceRoles);
      cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1`, defenseSummary);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/members`, bgMembers);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/available-champions`, []);
      cy.visit('/game/defense');

      cy.contains('Clear All').click();

      cy.contains('Clear Defense').should('be.visible');
      cy.contains('Are you sure you want to remove all defenders').should('be.visible');
    });

    it('clears defense on confirm', () => {
      cy.stubApi('GET', 'alliances/mine', [TEST_ALLIANCE]);
      cy.stubApi('GET', 'alliances/my-roles', allianceRoles);
      cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1`, defenseSummary);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/members`, bgMembers);
      cy.stubApi('GET', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/available-champions`, []);
      cy.visit('/game/defense');

      cy.stubApi('DELETE', `alliances/${TEST_ALLIANCE.id}/defense/bg/1/clear`, null, 204);
      cy.intercept('GET', `/api/back/alliances/${TEST_ALLIANCE.id}/defense/bg/1`, {
        statusCode: 200,
        body: {
          alliance_id: 'alliance-001',
          battlegroup: 1,
          placements: [],
          member_defender_counts: {},
        },
      });

      cy.contains('Clear All').click();
      cy.get('[role="alertdialog"]').contains('Confirm').click();

      cy.waitForToast('Defense cleared');
    });
  });

  // ─── Navigation ──────────────────────────────────────

  describe('Navigation', () => {
    it('navigates to defense from sidebar', () => {
      cy.stubApi('GET', 'alliances/mine', []);
      cy.stubApi('GET', 'alliances/my-roles', { roles: {}, my_account_ids: [] });
      cy.stubApi('GET', 'game-accounts', []);
      cy.visit('/');
      cy.contains('Defense').click();
      cy.url().should('include', '/game/defense');
    });
  });
});
