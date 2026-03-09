/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Truncate all database tables via the dev endpoint (direct backend call).
     */
    truncateDb(): Chainable<void>;

    /**
     * Register a user via Discord OAuth mock (direct backend call) and return tokens.
     */
    registerUser(accessToken?: string): Chainable<{
      access_token: string;
      refresh_token: string;
    }>;

    /**
     * Create a game account via backend API.
     */
    apiCreateGameAccount(
      token: string,
      pseudo: string,
      isPrimary?: boolean
    ): Chainable<any>;

    /**
     * Load a champion via admin backend API.
     */
    apiLoadChampion(
      adminToken: string,
      name: string,
      championClass: string,
      options?: { is_ascendable?: boolean }
    ): Chainable<any>;

    /**
     * Create an alliance via backend API.
     */
    apiCreateAlliance(
      token: string,
      name: string,
      tag: string,
      ownerGameAccountId: string
    ): Chainable<any>;

    /**
     * Log in via the dev-login UI on the login page.
     * Clicks the button matching the user's login name.
     */
    uiLogin(userName: string): Chainable<void>;
  }
}
