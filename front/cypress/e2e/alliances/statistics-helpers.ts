export function createAndActivateSeason(adminToken: string) {
  return cy.apiCreateOpenSeason(adminToken, 64);
}

// Create + open a season and yield its id (needed to close it later).
export function createOpenSeason(adminToken: string, number = 64): Cypress.Chainable<string> {
  return cy.apiCreateOpenSeason(adminToken, number);
}

// Close a season (active -> ended), leaving no active season (pre-season state).
export function closeSeason(adminToken: string, seasonId: string) {
  return cy.apiCloseSeason(adminToken, seasonId);
}

export function addStatsForPlayer(
  token: string,
  allianceId: string,
  warId: string,
  champId: string,
  championUserId: string,
  nodeNumber: number,
  koCount = 0,
  bg = 1,
) {
  cy.apiPlaceWarDefender(token, allianceId, warId, bg, nodeNumber, champId, 7, 3, 0);
  cy.apiAssignWarAttacker(token, allianceId, warId, bg, nodeNumber, championUserId);
  if (koCount > 0) cy.apiUpdateWarKo(token, allianceId, warId, bg, nodeNumber, koCount);
}

// ── Alliance setup preamble ───────────────────────────────────────────────────
// Every statistics spec opens with the same admin + owner (+ member) batch setup.
// Names are derived from the spec prefix; the DB is truncated between tests, so
// derived alliance names and tags never collide.

export interface StatsOwnerSetup {
  adminToken: string;
  ownerToken: string;
  ownerUserId: string;
  ownerAccId: string;
  ownerPseudo: string;
  allianceId: string;
}

export interface StatsOwnerMemberSetup extends StatsOwnerSetup {
  memberToken: string;
  memberUserId: string;
  memberAccId: string;
  memberPseudo: string;
}

function statsBase(prefix: string): string {
  const cleaned = prefix.replace(/^stat-/, '').replace(/[^A-Za-z0-9]/g, '') || 'stat';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1, 8);
}

function allianceSpec(base: string) {
  return { name: `${base}Alliance`, tag: base.toUpperCase().slice(0, 5) };
}

export function setupStatsOwner(prefix: string): Cypress.Chainable<StatsOwnerSetup> {
  const base = statsBase(prefix);
  const adminTok = `${prefix}-admin`;
  const ownerTok = `${prefix}-owner`;

  return cy
    .apiBatchSetup([
      { discord_token: adminTok, role: 'admin' },
      {
        discord_token: ownerTok,
        game_pseudo: `${base}Owner`,
        create_alliance: allianceSpec(base),
        battlegroup: 1,
      },
    ])
    .then((users) => ({
      adminToken: users[adminTok].access_token,
      ownerToken: users[ownerTok].access_token,
      ownerUserId: users[ownerTok].user_id,
      ownerAccId: users[ownerTok].account_id!,
      ownerPseudo: `${base}Owner`,
      allianceId: users[ownerTok].alliance_id!,
    }));
}

// ── War scenarios ─────────────────────────────────────────────────────────────
// One batch-setup call each. Only what makes a war progress stays explicit —
// defender, attacker, KOs, end — the batch has no equivalent for it.

const IRON_MAN = { name: 'Iron Man', champion_class: 'Tech' };
const WOLVERINE = { name: 'Wolverine', champion_class: 'Mutant' };

interface ScenarioSpec {
  champions: { name: string; champion_class: string }[];
  ownerRoster: string[];
  memberRoster?: string[];
  warName?: string;
  memberBattlegroup?: number;
  seasonNumber?: number;
}

export interface ScenarioContext extends StatsOwnerMemberSetup {
  /** Champion name → champion id, for every champion the scenario loaded. */
  champions: Record<string, string>;
  /** Champion name → champion_user id, for the owner's roster. */
  ownerCu: Record<string, string>;
  /** Champion name → champion_user id, for the member's roster. */
  memberCu: Record<string, string>;
  /** Season number (as a string) → season id. */
  seasonIds: Record<string, string>;
  warId: string;
}

// Member fields come back empty when the spec declares no member.
function scenarioBatch(prefix: string, spec: ScenarioSpec): Cypress.Chainable<ScenarioContext> {
  const base = statsBase(prefix);
  const adminTok = `${prefix}-admin`;
  const ownerTok = `${prefix}-owner`;
  const memberTok = `${prefix}-member`;
  const roster = (names: string[]) => names.map((champion) => ({ champion }));

  return cy
    .apiBatchSetupFull([
      {
        discord_token: adminTok,
        role: 'admin',
        champions: spec.champions,
        seasons: [{ number: spec.seasonNumber ?? 64, status: 'active' as const }],
      },
      {
        discord_token: ownerTok,
        game_pseudo: `${base}Owner`,
        create_alliance: allianceSpec(base),
        battlegroup: 1,
        roster: roster(spec.ownerRoster),
        ...(spec.warName ? { create_war: { opponent_name: spec.warName } } : {}),
      },
      ...(spec.memberRoster
        ? [
            {
              discord_token: memberTok,
              game_pseudo: `${base}Member`,
              join_alliance_token: ownerTok,
              battlegroup: spec.memberBattlegroup ?? 1,
              roster: roster(spec.memberRoster),
            },
          ]
        : []),
    ])
    .then(({ users, champions, seasons }) => {
      const owner = users[ownerTok];
      const member = users[memberTok];
      return {
        adminToken: users[adminTok].access_token,
        ownerToken: owner.access_token,
        ownerUserId: owner.user_id,
        ownerAccId: owner.account_id!,
        ownerPseudo: `${base}Owner`,
        allianceId: owner.alliance_id!,
        memberToken: member?.access_token ?? '',
        memberUserId: member?.user_id ?? '',
        memberAccId: member?.account_id ?? '',
        memberPseudo: `${base}Member`,
        champions,
        ownerCu: owner.champion_user_ids,
        memberCu: member?.champion_user_ids ?? {},
        seasonIds: seasons,
        warId: owner.war_id ?? '',
      };
    });
}

export interface WarScenario extends ScenarioContext {
  champId: string;
  cuId: string;
}

export function withWarScenario(prefix: string, warName: string): Cypress.Chainable<WarScenario> {
  return scenarioBatch(prefix, {
    champions: [IRON_MAN],
    ownerRoster: ['Iron Man'],
    warName,
  }).then((ctx) => ({
    ...ctx,
    champId: ctx.champions['Iron Man'],
    cuId: ctx.ownerCu['Iron Man'],
  }));
}

export interface TwoPlayerWarScenario extends ScenarioContext {
  champId: string;
  cuOwnerId: string;
  cuMemberId: string;
}

export function withWarScenarioTwoPlayers(
  prefix: string,
  warName: string,
  memberBattlegroup = 1,
): Cypress.Chainable<TwoPlayerWarScenario> {
  return scenarioBatch(prefix, {
    champions: [IRON_MAN],
    ownerRoster: ['Iron Man'],
    memberRoster: ['Iron Man'],
    warName,
    memberBattlegroup,
  }).then((ctx) => ({
    ...ctx,
    champId: ctx.champions['Iron Man'],
    cuOwnerId: ctx.ownerCu['Iron Man'],
    cuMemberId: ctx.memberCu['Iron Man'],
  }));
}

export interface DiffChampsWarScenario extends ScenarioContext {
  champ1Id: string;
  champ2Id: string;
  cuOwnerId: string;
  cuMemberId: string;
}

// Different champion each, to tell a champion-keyed legend from a player-keyed one.
export function withWarScenarioDiffChampsPlayers(
  prefix: string,
  warName: string,
  memberBattlegroup = 1,
): Cypress.Chainable<DiffChampsWarScenario> {
  return scenarioBatch(prefix, {
    champions: [IRON_MAN, WOLVERINE],
    ownerRoster: ['Iron Man'],
    memberRoster: ['Wolverine'],
    warName,
    memberBattlegroup,
  }).then((ctx) => ({
    ...ctx,
    champ1Id: ctx.champions['Iron Man'],
    champ2Id: ctx.champions['Wolverine'],
    cuOwnerId: ctx.ownerCu['Iron Man'],
    cuMemberId: ctx.memberCu['Wolverine'],
  }));
}

export interface TwoChampsWarScenario extends ScenarioContext {
  champ1Id: string;
  champ2Id: string;
  cu1Id: string;
  cu2Id: string;
}

// Both champions belong to the owner: two roster entries, one player.
export function withWarScenarioTwoOwnerChamps(
  prefix: string,
  warName: string,
): Cypress.Chainable<TwoChampsWarScenario> {
  return scenarioBatch(prefix, {
    champions: [IRON_MAN, WOLVERINE],
    ownerRoster: ['Iron Man', 'Wolverine'],
    warName,
  }).then((ctx) => ({
    ...ctx,
    champ1Id: ctx.champions['Iron Man'],
    champ2Id: ctx.champions['Wolverine'],
    cu1Id: ctx.ownerCu['Iron Man'],
    cu2Id: ctx.ownerCu['Wolverine'],
  }));
}

export interface DefenderWarScenario extends ScenarioContext {
  champ1Id: string;
  champ2Id: string;
  cuId: string;
}

// The second champion is never rostered: a defender needs an id, not a roster entry.
export function withWarScenarioDefender(prefix: string, warName: string): Cypress.Chainable<DefenderWarScenario> {
  return scenarioBatch(prefix, {
    champions: [IRON_MAN, WOLVERINE],
    ownerRoster: ['Iron Man'],
    warName,
  }).then((ctx) => ({
    ...ctx,
    champ1Id: ctx.champions['Iron Man'],
    champ2Id: ctx.champions['Wolverine'],
    cuId: ctx.ownerCu['Iron Man'],
  }));
}

export interface TwoWarsScenario extends ScenarioContext {
  warOneId: string;
  warTwoId: string;
}

// Two ended wars, one player each. The second war is not batched: a spec
// declares at most one.
export function withTwoEndedWarsTwoPlayers(prefix: string): Cypress.Chainable<TwoWarsScenario> {
  return scenarioBatch(prefix, {
    champions: [IRON_MAN],
    ownerRoster: ['Iron Man'],
    memberRoster: ['Iron Man'],
    warName: 'WarOne',
  }).then((ctx) => {
    const { ownerToken, allianceId, warId: warOneId } = ctx;
    const champId = ctx.champions['Iron Man'];

    addStatsForPlayer(ownerToken, allianceId, warOneId, champId, ctx.ownerCu['Iron Man'], 10, 0);
    cy.apiEndWar(ownerToken, allianceId, warOneId, true, 10);

    return cy.apiCreateWar(ownerToken, allianceId, 'WarTwo').then((warTwo: { id: string }) => {
      addStatsForPlayer(ownerToken, allianceId, warTwo.id, champId, ctx.memberCu['Iron Man'], 11, 2);
      cy.apiEndWar(ownerToken, allianceId, warTwo.id, true, 10);
      return cy.wrap({ ...ctx, warOneId, warTwoId: warTwo.id }, { log: false });
    });
  });
}

export interface TwoSeasonsScenario extends ScenarioContext {
  pastSeasonId: string;
  currentSeasonId: string;
}

// Not batchable: a war is stamped with the season active when it is created, so
// the second one has to wait for the swap.
export function withTwoSeasonsOneWarEach(prefix: string): Cypress.Chainable<TwoSeasonsScenario> {
  return scenarioBatch(prefix, {
    champions: [IRON_MAN],
    ownerRoster: ['Iron Man'],
    memberRoster: ['Iron Man'],
    warName: 'OldWar',
    seasonNumber: 63,
  }).then((ctx) => {
    const { adminToken, ownerToken, allianceId, warId: oldWarId } = ctx;
    const champId = ctx.champions['Iron Man'];
    const pastSeasonId = ctx.seasonIds['63'];

    addStatsForPlayer(ownerToken, allianceId, oldWarId, champId, ctx.ownerCu['Iron Man'], 10, 3);
    cy.apiEndWar(ownerToken, allianceId, oldWarId, true, 10);
    closeSeason(adminToken, pastSeasonId);

    return createOpenSeason(adminToken, 64).then((currentSeasonId) => {
      cy.apiCreateWar(ownerToken, allianceId, 'NewWar').then((newWar: { id: string }) => {
        addStatsForPlayer(ownerToken, allianceId, newWar.id, champId, ctx.memberCu['Iron Man'], 11, 0);
        cy.apiEndWar(ownerToken, allianceId, newWar.id, true, 10);
      });
      return cy.wrap({ ...ctx, pastSeasonId, currentSeasonId }, { log: false });
    });
  });
}

export interface EndedAssistWarSetup extends ScenarioContext {
  ironManId: string;
  ownerCuId: string;
  memberCuId: string;
}

// An ended war where the member assisted the owner on the same node, which is
// what splits a fight 0.5/0.5 between them. The assist has no batch equivalent.
export function setupEndedAssistWar(prefix: string): Cypress.Chainable<EndedAssistWarSetup> {
  return scenarioBatch(prefix, {
    champions: [IRON_MAN, WOLVERINE],
    ownerRoster: ['Iron Man'],
    memberRoster: ['Wolverine'],
    warName: 'AstEnemy',
  }).then((ctx) => {
    const { ownerToken, memberToken, allianceId, warId } = ctx;
    const ironManId = ctx.champions['Iron Man'];
    const ownerCuId = ctx.ownerCu['Iron Man'];
    const memberCuId = ctx.memberCu['Wolverine'];

    cy.apiPlaceWarDefender(ownerToken, allianceId, warId, 1, 10, ironManId, 7, 3, 0);
    cy.apiAssignWarAttacker(ownerToken, allianceId, warId, 1, 10, ownerCuId);
    cy.apiRequest(memberToken, 'POST', `/alliances/${allianceId}/wars/${warId}/bg/1/node/10/assist`, {
      champion_user_id: memberCuId,
    });
    cy.apiEndWar(ownerToken, allianceId, warId, true, 10);

    // cy.wrap, not a bare return: a `.then` cannot both enqueue and return a value.
    return cy.wrap({ ...ctx, ironManId, ownerCuId, memberCuId }, { log: false });
  });
}

// Remove a member from the alliance — used to turn them into a "former member".
export function removeAllianceMember(ownerToken: string, allianceId: string, gameAccountId: string) {
  return cy.apiRequest(ownerToken, 'DELETE', `/alliances/${allianceId}/members/${gameAccountId}`);
}

// Open the statistics tab as the given user and pick a member-filter option.
export function openStatsAs(userId: string) {
  cy.apiLogin(userId);
  cy.goToAllianceStatsTab();
}

export function selectMemberFilter(label: 'All members' | 'Former members') {
  cy.getByCy('statistics-member-filter').click();
  cy.contains(label).click();
}

export interface EndedWarStats extends StatsOwnerSetup {
  champId: string;
  cuId: string;
  warId: string;
}

// The five-line preamble most statistics tests open with: an owner, one war where
// they fought node 10, the war ended, and the statistics tab already open.
// `koCount` drives the ratio; `endWar: false` leaves the war active, which is what
// the "only an ongoing war" empty state needs.
export function withEndedWarStats(
  prefix: string,
  cb: (ctx: EndedWarStats) => void,
  options: { koCount?: number; endWar?: boolean; warName?: string } = {},
) {
  const { koCount = 0, endWar = true, warName = 'Enemy' } = options;

  return withWarScenario(prefix, warName).then((ctx) => {
    const { ownerToken, ownerUserId, allianceId, champId, cuId, warId } = ctx;
    addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, koCount);
    if (endWar) cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
    openStatsAs(ownerUserId);
    cb(ctx);
  });
}
