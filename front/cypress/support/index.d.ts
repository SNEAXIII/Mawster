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
      ownerId: string
    ): Chainable<any>;

    /**
     * Add a champion to a player's roster via backend API.
     */
    apiAddChampionToRoster(
      token: string,
      gameAccountId: string,
      championId: string,
      rarity: string,
      options?: { signature?: number; is_preferred_attacker?: boolean; ascension?: number }
    ): Chainable<any>;

    /**
     * Place a defender on a defense node via backend API.
     */
    apiPlaceDefender(
      token: string,
      allianceId: string,
      battlegroup: number,
      nodeNumber: number,
      championUserId: string,
      gameAccountId: string
    ): Chainable<any>;

    /**
     * Set (or unset) the battlegroup for an alliance member via backend API.
     */
    apiSetMemberGroup(
      token: string,
      allianceId: string,
      gameAccountId: string,
      group: number | null
    ): Chainable<any>;

    /**
     * Invite a game account to an alliance via backend API.
     */
    apiInviteMember(
      token: string,
      allianceId: string,
      gameAccountId: string
    ): Chainable<any>;

    /**
     * Force a user to join an alliance via dev endpoint (bypasses invitations).
     */
    apiForceJoinAlliance(
      gameAccountId: string,
      allianceId: string
    ): Chainable<any>;

    /**
     * Promote a member to officer in an alliance via backend API.
     */
    apiAddOfficer(
      token: string,
      allianceId: string,
      gameAccountId: string
    ): Chainable<any>;

    /**
     * Truncate the DB then run all fixture scripts (POST /dev/fixtures).
     */
    runFixtures(): void;

    /**
     * Create an upgrade request for a champion user (POST /champion-users/upgrade-requests).
     */
    apiCreateUpgradeRequest(
      token: string,
      championUserId: string,
      requestedRarity: string
    ): Chainable<any>;

    /**
     * Upgrade a champion to the next rank (PATCH /champion-users/{id}/upgrade).
     */
    apiUpgradeChampion(token: string, championUserId: string): Chainable<any>;

    /**
     * Log in via the dev-login UI on the login page.
     * Clicks the button matching the user's login name.
     */
    uiLogin(userName: string): Chainable<void>;

    /**
     * Navigate to a page by clicking the corresponding navbar link.
     * @param page - The page identifier (e.g. "alliances", "profile", "roster", "defense", "champions", "administration", "home")
     */
    navTo(page: string): Chainable<void>;

    /**
     * Select a DOM element by its `data-cy` attribute.
     */
    getByCy(selector: string): Chainable<JQuery<HTMLElement>>;
  }
}
