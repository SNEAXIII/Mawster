/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Truncate all database tables via the dev endpoint (direct backend call).
     */
    truncateDb(): Chainable<void>;

    /**
     * Create N users with optional game accounts, alliances, and battlegroup assignments
     * in a single backend request. Returns a map of discord_token → user result.
     */
    apiBatchSetup(
      specs: Array<{
        discord_token: string;
        role?: string;
        game_pseudo?: string;
        create_alliance?: { name: string; tag: string };
        join_alliance_token?: string;
        battlegroup?: number;
      }>,
    ): Chainable<
      Record<
        string,
        {
          access_token: string;
          refresh_token: string;
          user_id: string;
          login: string;
          email: string;
          discord_id: string;
          account_id: string | null;
          alliance_id: string | null;
        }
      >
    >;

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
    apiCreateGameAccount(token: string, pseudo: string, isPrimary?: boolean): Chainable<any>;

    /**
     * Load a champion via admin backend API.
     */
    apiLoadChampion(
      adminToken: string,
      name: string,
      championClass: string,
      options?: { is_ascendable?: boolean },
    ): Chainable<any>;

    /**
     * Load multiple champions in a single bulk request.
     * Returns a map of champion name → { id, name }.
     */
    apiLoadChampions(
      adminToken: string,
      champions: Array<{ name: string; cls: string; is_ascendable?: boolean }>,
    ): Chainable<Record<string, { id: string; name: string }>>;

    /**
     * Create an alliance via backend API.
     */
    apiCreateAlliance(token: string, name: string, tag: string, ownerId: string): Chainable<any>;

    /**
     * Add a champion to a player's roster via backend API.
     */
    apiAddChampionToRoster(
      token: string,
      gameAccountId: string,
      championId: string,
      rarity: string,
      options?: { signature?: number; is_preferred_attacker?: boolean; ascension?: number },
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
      gameAccountId: string,
    ): Chainable<any>;

    /**
     * Set (or unset) the battlegroup for an alliance member via backend API.
     */
    apiSetMemberGroup(token: string, allianceId: string, gameAccountId: string, group: number | null): Chainable<any>;

    /**
     * Invite a game account to an alliance via backend API.
     */
    apiInviteMember(token: string, allianceId: string, gameAccountId: string): Chainable<any>;

    /**
     * Force a user to join an alliance via dev endpoint (bypasses invitations).
     */
    apiForceJoinAlliance(gameAccountId: string, allianceId: string): Chainable<any>;

    /**
     * Promote a member to officer in an alliance via backend API.
     */
    apiAddOfficer(token: string, allianceId: string, gameAccountId: string): Chainable<any>;

    /**
     * Demote an officer back to member in an alliance via backend API.
     */
    apiRemoveOfficer(token: string, allianceId: string, gameAccountId: string): Chainable<any>;

    /**
     * Remove (exclude) a member from an alliance via backend API.
     */
    apiRemoveMember(token: string, allianceId: string, gameAccountId: string): Chainable<any>;

    /**
     * Truncate the DB then run all fixture scripts (POST /dev/fixtures).
     */
    runFixtures(): void;

    /**
     * Create an upgrade request for a champion user (POST /champion-users/upgrade-requests).
     */
    apiCreateUpgradeRequest(token: string, championUserId: string, requestedRarity: string): Chainable<any>;

    /**
     * Upgrade a champion to the next rank (PATCH /champion-users/{id}/upgrade).
     */
    apiUpgradeChampion(token: string, championUserId: string): Chainable<any>;

    /**
     * Log in via the dev API (no UI). Faster than uiLogin.
     * Pass ownerData.user_id (UUID).
     */
    apiLogin(userId: string): Chainable<void>;

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

    /** Declare a war against an opponent (direct backend call). */
    apiCreateWar(token: string, allianceId: string, opponentName: string, bannedChampionIds?: string[]): Chainable<any>;

    /** Place a champion on a war defense node (direct backend call). */
    apiPlaceWarDefender(
      token: string,
      allianceId: string,
      warId: string,
      battlegroup: number,
      nodeNumber: number,
      championId: string,
      stars: number,
      rank: number,
      ascension?: number,
    ): Chainable<any>;

    /** Remove a defender from a war node (direct backend call). */
    apiRemoveWarDefender(
      token: string,
      allianceId: string,
      warId: string,
      battlegroup: number,
      nodeNumber: number,
    ): Chainable<void>;

    /** Mark a war as ended (direct backend call). */
    apiEndWar(token: string, allianceId: string, warId: string): Chainable<any>;

    /** Assign an attacker champion to a war node (direct backend call). */
    apiAssignWarAttacker(
      token: string,
      allianceId: string,
      warId: string,
      battlegroup: number,
      nodeNumber: number,
      championUserId: string,
    ): Chainable<any>;

    /** Remove attacker from a war node (direct backend call). */
    apiRemoveWarAttacker(
      token: string,
      allianceId: string,
      warId: string,
      battlegroup: number,
      nodeNumber: number,
    ): Chainable<any>;

    /** Update KO count for a war node (direct backend call). */
    apiUpdateWarKo(
      token: string,
      allianceId: string,
      warId: string,
      battlegroup: number,
      nodeNumber: number,
      koCount: number,
    ): Chainable<any>;

    /** Add a synergy champion for a war battlegroup (direct backend call). */
    apiAddWarSynergy(
      token: string,
      allianceId: string,
      warId: string,
      battlegroup: number,
      championUserId: string,
      targetChampionUserId: string,
    ): Chainable<any>;

    /** Remove a synergy champion from a war battlegroup (direct backend call). */
    apiRemoveWarSynergy(
      token: string,
      allianceId: string,
      warId: string,
      battlegroup: number,
      championUserId: string,
    ): Chainable<void>;
  }
}
