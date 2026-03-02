/// <reference types="cypress" />

/**
 * Custom Cypress commands for Mawster E2E tests.
 *
 * Auth strategy: We generate a real encrypted NextAuth JWT cookie (same
 * crypto as NextAuth v5) so the server-side middleware sees a valid session.
 * We also intercept GET /api/auth/session for client-side useSession() calls.
 * API calls through /api/back are intercepted and stubbed per-test.
 */

// ─── Types ───────────────────────────────────────────────

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  avatar_url: string | null;
  discord_id: string;
  created_at: string;
}

export interface MockGameAccount {
  id: string;
  user_id: string;
  alliance_id: string | null;
  alliance_group: number | null;
  alliance_tag: string | null;
  alliance_name: string | null;
  game_pseudo: string;
  is_primary: boolean;
  created_at: string;
}

export interface MockAlliance {
  id: string;
  name: string;
  tag: string;
  owner_id: string;
  owner_pseudo: string;
  created_at: string;
  officers: any[];
  members: any[];
  member_count: number;
}

export interface MockChampion {
  id: string;
  name: string;
  champion_class: string;
  image_url: string | null;
  is_7_star: boolean;
  alias: string | null;
}

// ─── Test Fixtures ───────────────────────────────────────

export const TEST_USER: MockUser = {
  id: 'user-001',
  name: 'TestPlayer',
  email: 'testplayer@discord.com',
  role: 'user',
  avatar_url: null,
  discord_id: '123456789',
  created_at: '2024-01-15T10:30:00Z',
};

export const TEST_ADMIN: MockUser = {
  id: 'admin-001',
  name: 'AdminPlayer',
  email: 'admin@discord.com',
  role: 'admin',
  avatar_url: null,
  discord_id: '987654321',
  created_at: '2024-01-01T08:00:00Z',
};

export const TEST_GAME_ACCOUNT: MockGameAccount = {
  id: 'ga-001',
  user_id: 'user-001',
  alliance_id: null,
  alliance_group: null,
  alliance_tag: null,
  alliance_name: null,
  game_pseudo: 'MyHero42',
  is_primary: true,
  created_at: '2024-02-01T12:00:00Z',
};

export const TEST_GAME_ACCOUNT_2: MockGameAccount = {
  id: 'ga-002',
  user_id: 'user-001',
  alliance_id: 'alliance-001',
  alliance_group: 1,
  alliance_tag: 'TST',
  alliance_name: 'Test Alliance',
  game_pseudo: 'AltAccount',
  is_primary: false,
  created_at: '2024-02-10T14:00:00Z',
};

export const TEST_ALLIANCE: MockAlliance = {
  id: 'alliance-001',
  name: 'Test Alliance',
  tag: 'TST',
  owner_id: 'ga-001',
  owner_pseudo: 'MyHero42',
  created_at: '2024-03-01T10:00:00Z',
  officers: [],
  members: [
    {
      id: 'ga-001',
      user_id: 'user-001',
      game_pseudo: 'MyHero42',
      alliance_group: 1,
      is_owner: true,
      is_officer: false,
    },
  ],
  member_count: 1,
};

export const TEST_CHAMPIONS: MockChampion[] = [
  { id: 'champ-001', name: 'Spider-Man', champion_class: 'Science', image_url: null, is_7_star: true, alias: 'Spidey' },
  { id: 'champ-002', name: 'Doctor Doom', champion_class: 'Mystic', image_url: null, is_7_star: true, alias: null },
  { id: 'champ-003', name: 'Wolverine', champion_class: 'Mutant', image_url: null, is_7_star: false, alias: 'Wolvie' },
  { id: 'champ-004', name: 'Iron Man', champion_class: 'Tech', image_url: null, is_7_star: true, alias: null },
  { id: 'champ-005', name: 'Black Widow', champion_class: 'Skill', image_url: null, is_7_star: false, alias: null },
];

// ─── Commands ────────────────────────────────────────────

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Mock a NextAuth session for the given user.
       * Sets an encrypted JWT cookie (for middleware) and intercepts
       * /api/auth/session (for client-side useSession).
       */
      mockSession(user?: MockUser): Chainable<void>;

      /**
       * Mock a NextAuth session for an admin user.
       */
      mockAdminSession(): Chainable<void>;

      /**
       * Intercept the API proxy and stub with a response.
       */
      stubApi(
        method: string,
        pathPattern: string,
        response: any,
        statusCode?: number,
      ): Chainable<void>;

      /**
       * Wait for a toast notification to appear with the given text.
       */
      waitForToast(text: string): Chainable<JQuery<HTMLElement>>;

      /**
       * Set locale in localStorage before visiting a page.
       */
      setLocale(locale: 'en' | 'fr'): Chainable<void>;
    }
  }
}

Cypress.Commands.add('mockSession', (user: MockUser = TEST_USER) => {
  // 1. Generate an encrypted JWT cookie so the Next.js middleware
  //    (which runs server-side) sees a valid authenticated session.
  const tokenPayload: Record<string, unknown> = {
    sub: user.id,
    name: user.name,
    email: user.email,
    id: user.id,
    role: user.role,
    accessToken: 'fake-backend-jwt-for-cypress',
    backendRefreshToken: 'fake-refresh-token',
    accessTokenExpires: Date.now() + 24 * 60 * 60 * 1000,
    expired: false,
    backendAuthenticated: true,
  };

  cy.task('generateSessionCookie', tokenPayload).then((encoded) => {
    cy.setCookie('authjs.session-token', encoded as string, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });
  });

  // 2. Intercept the client-side GET /api/auth/session so useSession()
  //    receives the full user profile without calling the real backend.
  cy.intercept('GET', '/api/auth/session', {
    statusCode: 200,
    body: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url,
        discord_id: user.discord_id,
        created_at: user.created_at,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  }).as('session');
});

Cypress.Commands.add('mockAdminSession', () => {
  cy.mockSession(TEST_ADMIN);
});

Cypress.Commands.add(
  'stubApi',
  (method: string, pathPattern: string, response: any, statusCode: number = 200) => {
    const routeMatcher = {
      method: method.toUpperCase(),
      url: `/api/back/${pathPattern}`,
    };
    cy.intercept(routeMatcher, {
      statusCode,
      body: response,
    });
  },
);

Cypress.Commands.add('waitForToast', (text: string) => {
  return cy.contains('[data-sonner-toast]', text, { timeout: 8000 }).should('be.visible');
});

Cypress.Commands.add('setLocale', (locale: 'en' | 'fr') => {
  // Store in Cypress env so it can be applied onBeforeLoad during cy.visit
  Cypress.env('locale', locale);
});

// Automatically apply locale to localStorage before each page load
beforeEach(() => {
  const locale = Cypress.env('locale') || 'en';
  cy.on('window:before:load', (win) => {
    win.localStorage.setItem('mawster-locale', locale);
  });
});

export {};
