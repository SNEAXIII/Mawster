/// <reference types="cypress" />

import {
  TEST_GAME_ACCOUNT,
  TEST_GAME_ACCOUNT_2,
  TEST_ALLIANCE,
  type MockGameAccount,
  type MockAlliance,
} from '../support/commands';

/**
 * E2E tests for the Alliances page.
 * Verifies alliance CRUD, invitation flow, officers, groups, and members.
 */
describe('Alliances Page', () => {
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

  /** Stub all API calls the alliances page makes on mount */
  function stubAlliancesPage(
    alliances: MockAlliance[] = [],
    invitations: any[] = [],
    extraStubs?: () => void,
  ) {
    cy.stubApi('GET', 'alliances/mine', alliances);
    cy.stubApi('GET', 'alliances/my-roles', alliances.length
      ? allianceRoles
      : { roles: {}, my_account_ids: [] },
    );
    cy.stubApi('GET', 'alliances/my-invitations', invitations);
    cy.stubApi('GET', 'alliances/eligible-owners', alliances.length ? [TEST_GAME_ACCOUNT] : []);
    cy.stubApi('GET', 'alliances/eligible-members', []);
    cy.stubApi('GET', 'game-accounts', [TEST_GAME_ACCOUNT]);

    // Stub per-alliance pending invitations
    for (const a of alliances) {
      cy.stubApi('GET', `alliances/${a.id}/invitations`, []);
    }

    extraStubs?.();
  }

  beforeEach(() => {
    cy.mockSession();
    cy.setLocale('en');
  });

  // ─── Display ─────────────────────────────────────────

  describe('Display', () => {
    it('shows the page title and description', () => {
      stubAlliancesPage();
      cy.visit('/game/alliances');

      cy.contains('Alliances').should('be.visible');
    });

    it('shows empty state when no alliances', () => {
      stubAlliancesPage();
      cy.visit('/game/alliances');

      cy.contains('No alliances yet').should('be.visible');
    });

    it('renders alliance cards with member count', () => {
      stubAlliancesPage([TEST_ALLIANCE]);
      cy.visit('/game/alliances');

      cy.contains('Test Alliance').should('be.visible');
      cy.contains('[TST]').should('be.visible');
      cy.contains('1').should('be.visible'); // member count
    });
  });

  // ─── Create alliance ────────────────────────────────

  describe('Create alliance', () => {
    beforeEach(() => {
      stubAlliancesPage([], [], () => {
        cy.stubApi('GET', 'alliances/eligible-owners', [TEST_GAME_ACCOUNT]);
      });
    });

    it('shows the create alliance form', () => {
      cy.visit('/game/alliances');

      cy.contains('Create an alliance').should('be.visible');
      cy.contains('Create alliance').should('be.visible');
    });

    it('creates a new alliance successfully', () => {
      cy.visit('/game/alliances');

      const newAlliance: MockAlliance = {
        id: 'alliance-new',
        name: 'New Warriors',
        tag: 'NW',
        owner_id: 'ga-001',
        owner_pseudo: 'MyHero42',
        created_at: new Date().toISOString(),
        officers: [],
        members: [
          {
            id: 'ga-001',
            user_id: 'user-001',
            game_pseudo: 'MyHero42',
            alliance_group: null,
            is_owner: true,
            is_officer: false,
          },
        ],
        member_count: 1,
      };

      cy.stubApi('POST', 'alliances', newAlliance, 201);

      // Re-stub the GET calls for refresh after creation
      cy.intercept('GET', '/api/back/alliances/mine', { statusCode: 200, body: [newAlliance] });
      cy.intercept('GET', '/api/back/alliances/my-roles', {
        statusCode: 200,
        body: {
          roles: { 'alliance-new': { is_owner: true, is_officer: false, can_manage: true } },
          my_account_ids: ['ga-001'],
        },
      });
      cy.intercept('GET', `/api/back/alliances/${newAlliance.id}/invitations`, {
        statusCode: 200,
        body: [],
      });

      // Fill the form
      cy.get('input[placeholder="e.g. Mighty Warriors"]').type('New Warriors');
      cy.get('input[placeholder="e.g. MW"]').type('NW');

      // Select the owner account
      cy.contains('Select a game account').click();
      cy.contains('MyHero42').click();

      cy.contains('Create alliance').click();

      cy.waitForToast('Alliance created successfully!');
    });

    it('shows message when no game accounts exist', () => {
      cy.stubApi('GET', 'alliances/eligible-owners', []);
      cy.stubApi('GET', 'game-accounts', []);
      cy.visit('/game/alliances');

      cy.contains('You need to create a game account first').should('be.visible');
    });
  });

  // ─── Invitations ─────────────────────────────────────

  describe('Invitations', () => {
    const pendingInvitation = {
      id: 'inv-001',
      alliance_id: 'alliance-002',
      alliance_name: 'Other Alliance',
      alliance_tag: 'OTH',
      game_account_id: 'ga-001',
      game_account_pseudo: 'MyHero42',
      invited_by_game_account_id: 'ga-ext',
      invited_by_pseudo: 'ExternalPlayer',
      status: 'pending',
      created_at: '2024-03-15T10:00:00Z',
      responded_at: null,
    };

    it('displays received invitations', () => {
      stubAlliancesPage([], [pendingInvitation]);
      cy.visit('/game/alliances');

      cy.contains('My invitations').should('be.visible');
      cy.contains('Other Alliance').should('be.visible');
      cy.contains('[OTH]').should('be.visible');
      cy.contains('ExternalPlayer').should('be.visible');
    });

    it('accepts an invitation', () => {
      stubAlliancesPage([], [pendingInvitation]);
      cy.visit('/game/alliances');

      cy.stubApi(
        'POST',
        `alliances/invitations/${pendingInvitation.id}/accept`,
        { ...pendingInvitation, status: 'accepted' },
      );
      // Refresh stubs after accepting
      cy.intercept('GET', '/api/back/alliances/my-invitations', { statusCode: 200, body: [] });

      cy.contains('Accept').click();

      cy.waitForToast('Invitation accepted! You joined the alliance.');
    });

    it('declines an invitation', () => {
      stubAlliancesPage([], [pendingInvitation]);
      cy.visit('/game/alliances');

      cy.stubApi(
        'POST',
        `alliances/invitations/${pendingInvitation.id}/decline`,
        { ...pendingInvitation, status: 'declined' },
      );
      cy.intercept('GET', '/api/back/alliances/my-invitations', { statusCode: 200, body: [] });

      cy.contains('Decline').click();

      cy.waitForToast('Invitation declined.');
    });
  });

  // ─── Members & Officers ──────────────────────────────

  describe('Members and Officers', () => {
    const allianceWithMembers: MockAlliance = {
      ...TEST_ALLIANCE,
      members: [
        {
          id: 'ga-001',
          user_id: 'user-001',
          game_pseudo: 'MyHero42',
          alliance_group: 1,
          is_owner: true,
          is_officer: false,
        },
        {
          id: 'ga-ext',
          user_id: 'user-002',
          game_pseudo: 'OtherPlayer',
          alliance_group: null,
          is_owner: false,
          is_officer: false,
        },
      ],
      member_count: 2,
    };

    it('displays alliance members', () => {
      stubAlliancesPage([allianceWithMembers]);
      cy.visit('/game/alliances');

      cy.contains('Members').should('be.visible');
      cy.contains('MyHero42').should('be.visible');
      cy.contains('OtherPlayer').should('be.visible');
    });
  });

  // ─── Navigation ──────────────────────────────────────

  describe('Navigation', () => {
    it('navigates to alliances from sidebar', () => {
      stubAlliancesPage();
      cy.visit('/');
      cy.contains('Alliances').click();
      cy.url().should('include', '/game/alliances');
    });
  });
});
