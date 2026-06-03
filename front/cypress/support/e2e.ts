/// <reference types="cypress" />

// Suppress benign ResizeObserver errors that occur in some browsers
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('ResizeObserver')) return false;
});

// Remove the default 10ms per-keystroke delay globally
Cypress.Commands.overwrite<'type', 'element'>('type', (originalFn, subject, text, options) => {
  return originalFn(subject, text, { delay: 0, ...options });
});

export const BACKEND: string = (Cypress.env('backendUrl') as string | undefined) ?? 'http://localhost:8001';

// Return a short alphanumeric prefix safe to use in generated names/tags.
function safePrefix(raw: string | undefined | null): string {
  const s = (raw ?? '').toString();
  const cleaned = s.replace(/[^A-Za-z0-9]/g, '');
  return (cleaned || s).slice(0, 8) || 'TST';
}
// ── E2E log markers — correlate backend logs with test boundaries ─────────

beforeEach(() => {
  const title = Cypress.currentTest.titlePath.join(' > ');
  cy.request({
    method: 'POST',
    url: `${BACKEND}/dev/log-marker`,
    body: { event: 'start', title },
    failOnStatusCode: false,
  });
});

afterEach(() => {
  const title = Cypress.currentTest.titlePath.join(' > ');
  const passed = (Cypress.currentTest as any).state === 'passed';
  cy.request({
    method: 'POST',
    url: `${BACKEND}/dev/log-marker`,
    body: { event: 'end', title, passed },
    failOnStatusCode: false,
  });
});

// ── Shared types ─────────────────────────────────────────────────────────────

export interface UserSetupData {
  access_token: string;
  refresh_token: string;
  user_id: string;
  login: string;
  email: string;
  discord_id: string;
}

// ── Custom selector: data-cy ─────────────────────────────────────────────────

Cypress.Commands.add('getByCy', (selector: string) => {
  return cy.get(`[data-cy="${selector}"]`);
});

// ── Truncate DB (direct backend call) ────────────────────────────────────────

Cypress.Commands.add('truncateDb', () => {
  cy.request({ method: 'POST', url: `${BACKEND}/dev/truncate`, timeout: 20000 }).then((res) => {
    expect(res.status).to.eq(200);
  });
});

// ── Batch setup (single request to create N users with accounts/alliances) ───

interface BatchSetupUserSpec {
  discord_token: string;
  role?: string;
  game_pseudo?: string;
  create_alliance?: { name: string; tag: string };
  join_alliance_token?: string;
  battlegroup?: number;
}

interface BatchSetupUserResult {
  access_token: string;
  refresh_token: string;
  user_id: string;
  login: string;
  email: string;
  discord_id: string;
  account_id: string | null;
  alliance_id: string | null;
}

Cypress.Commands.add('apiBatchSetup', (specs: BatchSetupUserSpec[]) => {
  cy.request({
    method: 'POST',
    url: `${BACKEND}/dev/batch-setup`,
    body: specs,
  }).then((res) => res.body.users as Record<string, BatchSetupUserResult>);
});

Cypress.Commands.add(
  'apiDevBulkCreateFightRecords',
  (warId: string, allianceId: string, gameAccountId: string, count: number, seasonId?: string | null) => {
    cy.request({
      method: 'POST',
      url: `${BACKEND}/dev/bulk-create-fight-records`,
      body: { war_id: warId, alliance_id: allianceId, game_account_id: gameAccountId, count, season_id: seasonId ?? null },
    }).then((res) => {
      expect(res.status).to.eq(201);
      return res.body;
    });
  },
);

Cypress.Commands.add(
  'apiBulkFillWarAttackers',
  (warId: string, battlegroup: number, gameAccountId: string, count: number) => {
    cy.request({
      method: 'POST',
      url: `${BACKEND}/dev/bulk-fill-war-attackers`,
      body: { war_id: warId, battlegroup, game_account_id: gameAccountId, count },
    }).then((res) => {
      expect(res.status).to.eq(200);
      return res.body;
    });
  },
);

// ── Register user via Discord mock (direct backend call) ─────────────────────

Cypress.Commands.add('registerUser', (accessToken = 'cypress-test-token') => {
  cy.request({
    method: 'POST',
    url: `${BACKEND}/auth/discord`,
    body: { access_token: accessToken },
  }).then((res) => {
    expect(res.status).to.eq(200);
    return res.body;
  });
});

// ── Create game account (direct backend call) ───────────────────────────────

Cypress.Commands.add('apiCreateGameAccount', (token: string, pseudo: string, isPrimary = false) => {
  cy.request({
    method: 'POST',
    url: `${BACKEND}/game-accounts`,
    headers: { Authorization: `Bearer ${token}` },
    body: { game_pseudo: pseudo, is_primary: isPrimary },
  }).then((res) => {
    expect(res.status).to.eq(201);
    return res.body;
  });
});

// ── Load champion (direct backend admin call) ───────────────────────────────

Cypress.Commands.add(
  'apiLoadChampion',
  (
    adminToken: string,
    name: string,
    championClass: string,
    options: { is_ascendable?: boolean; alias?: string; is_saga_attacker?: boolean; is_saga_defender?: boolean } = {},
  ) => {
    cy.request({
      method: 'POST',
      url: `${BACKEND}/admin/champions/load`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: [
        {
          name,
          champion_class: championClass,
          is_ascendable: options.is_ascendable ?? false,
          ...(options.alias !== undefined ? { alias: options.alias } : {}),
        },
      ],
    }).then((res) => {
      expect(res.status).to.eq(200);
      return cy
        .request({
          method: 'GET',
          url: `${BACKEND}/champions?search=${encodeURIComponent(name)}`,
          headers: { Authorization: `Bearer ${adminToken}` },
        })
        .then((getRes) => {
          const champs = getRes.body.champions.filter((c: { name: string }) => c.name === name);
          const champId = champs[0].id;
          let chain: Cypress.Chainable = cy.wrap(null);
          if (options.is_saga_attacker) {
            chain = chain.then(() =>
              cy.request({
                method: 'PATCH',
                url: `${BACKEND}/admin/champions/${champId}/saga-attacker`,
                headers: { Authorization: `Bearer ${adminToken}` },
              }),
            );
          }
          if (options.is_saga_defender) {
            chain = chain.then(() =>
              cy.request({
                method: 'PATCH',
                url: `${BACKEND}/admin/champions/${champId}/saga-defender`,
                headers: { Authorization: `Bearer ${adminToken}` },
              }),
            );
          }
          return chain.then(() => cy.wrap(champs));
        });
    });
  },
);

// ── Load multiple champions at once (single bulk request) ───────────────────

Cypress.Commands.add(
  'apiLoadChampions',
  (
    adminToken: string,
    champions: Array<{ name: string; cls: string; is_ascendable?: boolean; has_prefight?: boolean }>,
  ) => {
    cy.request({
      method: 'POST',
      url: `${BACKEND}/admin/champions/load`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: champions.map((c) => ({
        name: c.name,
        champion_class: c.cls,
        is_ascendable: c.is_ascendable ?? false,
        has_prefight: c.has_prefight ?? false,
      })),
    }).then(() =>
      cy
        .request({
          method: 'GET',
          url: `${BACKEND}/champions`,
          headers: { Authorization: `Bearer ${adminToken}` },
        })
        .then((res) => {
          const all: Array<{ id: string; name: string }> = res.body.champions ?? res.body;
          return Object.fromEntries(champions.map((c) => [c.name, all.find((x) => x.name === c.name)!])) as Record<
            string,
            { id: string; name: string }
          >;
        }),
    );
  },
);

// ── Create alliance (direct backend call) ────────────────────────────────────

Cypress.Commands.add('apiCreateAlliance', (token: string, name: string, tag: string, ownerId: string) => {
  cy.request({
    method: 'POST',
    url: `${BACKEND}/alliances`,
    headers: { Authorization: `Bearer ${token}` },
    body: { name, tag, owner_id: ownerId },
  }).then((res) => {
    expect(res.status).to.eq(201);
    return res.body;
  });
});

// ── Force-join a game account into an alliance (dev endpoint, bypasses invitations) ──

Cypress.Commands.add('apiForceJoinAlliance', (gameAccountId: string, allianceId: string) => {
  cy.request({
    method: 'POST',
    url: `${BACKEND}/dev/force-join-alliance`,
    body: { game_account_id: gameAccountId, alliance_id: allianceId },
  }).then((res) => {
    expect(res.status).to.eq(200);
  });
});

// ── API login — bypasses the UI entirely ─────────────────────────────────────

Cypress.Commands.add('apiLogin', (userId: string) => {
  cy.clearAllCookies();
  cy.clearAllSessionStorage();
  cy.clearAllLocalStorage();
  cy.request('POST', '/api/dev/login', { user_id: userId }).then((res) => {
    cy.setCookie('authjs.session-token', res.body.sessionToken);
  });
  cy.visit('/');
});

// ── UI login via dev-login flow ──────────────────────────────────────────────

Cypress.Commands.add('uiLogin', (userName: string) => {
  cy.clearAllCookies();
  cy.clearAllSessionStorage();
  cy.clearAllLocalStorage();
  cy.visit('/login');
  cy.contains('button', userName, { timeout: 10000 }).click();
  cy.url({ timeout: 10000 }).should('not.include', '/login');
});

// ── Navigate via navbar click ────────────────────────────────────────────────

const NAV_URLS: Record<string, string> = {
  admin: '/admin',
  administration: '/admin',
  alliances: '/game/alliances',
  defense: '/game/defense',
  profile: '/profile',
  roster: '/game/account',
  war: '/game/war',
};

Cypress.Commands.add('navTo', (page: string) => {
  cy.visit(NAV_URLS[page]);
});

// ── Invite member to alliance (direct backend call) ─────────────────────────

Cypress.Commands.add(
  'apiInviteMember',
  (token: string, allianceId: string, gameAccountId: string, type: 'member' | 'visitor' = 'member') => {
    cy.request({
      method: 'POST',
      url: `${BACKEND}/alliances/${allianceId}/invitations`,
      headers: { Authorization: `Bearer ${token}` },
      body: { game_account_id: gameAccountId, type },
    }).then((res) => {
      expect(res.status).to.eq(201);
      return res.body;
    });
  },
);

// ── Add champion to player roster (direct backend call) ─────────────────────

Cypress.Commands.add(
  'apiAddChampionToRoster',
  (
    token: string,
    gameAccountId: string,
    championId: string,
    rarity: string,
    options: { signature?: number; is_preferred_attacker?: boolean; ascension?: number } = {},
  ) => {
    cy.request({
      method: 'POST',
      url: `${BACKEND}/champion-users`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        game_account_id: gameAccountId,
        champion_id: championId,
        rarity,
        signature: options.signature ?? 0,
        is_preferred_attacker: options.is_preferred_attacker ?? false,
        ascension: options.ascension ?? 0,
      },
    }).then((res) => {
      expect(res.status).to.eq(201);
      return res.body;
    });
  },
);

// ── Place defender on defense node (direct backend call) ────────────────────

Cypress.Commands.add(
  'apiPlaceDefender',
  (
    token: string,
    allianceId: string,
    battlegroup: number,
    nodeNumber: number,
    championUserId: string,
    gameAccountId: string,
  ) => {
    cy.request({
      method: 'POST',
      url: `${BACKEND}/alliances/${allianceId}/defense/bg/${battlegroup}/place`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        node_number: nodeNumber,
        champion_user_id: championUserId,
        game_account_id: gameAccountId,
      },
    }).then((res) => {
      expect(res.status).to.eq(201);
      return res.body;
    });
  },
);

// ── Set member battlegroup (direct backend call) ─────────────────────────────

Cypress.Commands.add(
  'apiSetMemberGroup',
  (token: string, allianceId: string, gameAccountId: string, group: number | null) => {
    cy.request({
      method: 'PATCH',
      url: `${BACKEND}/alliances/${allianceId}/members/${gameAccountId}/group`,
      headers: { Authorization: `Bearer ${token}` },
      body: { group },
    }).then((res) => {
      expect(res.status).to.eq(200);
      return res.body;
    });
  },
);

// ── Add officer to alliance (direct backend call) ───────────────────────────

Cypress.Commands.add('apiAddOfficer', (token: string, allianceId: string, gameAccountId: string) => {
  cy.request({
    method: 'POST',
    url: `${BACKEND}/alliances/${allianceId}/officers`,
    headers: { Authorization: `Bearer ${token}` },
    body: { game_account_id: gameAccountId },
  }).then((res) => {
    expect(res.status).to.eq(201);
    return res.body;
  });
});

// ── Run fixtures (truncate DB + seed) ────────────────────────────────────────

Cypress.Commands.add('runFixtures', () => {
  cy.request('POST', `${BACKEND}/dev/fixtures`);
});

// ── Setup knowledge base scenario (light, no truncate) ──────────────────────────

export function setupKnowledgeBase(prefix: string): Cypress.Chainable<{
  adminToken: string;
  userData: UserSetupData;
  atkData: UserSetupData;
  accountId: string;
  allianceId: string;
}> {
  const adminToken = `${prefix}-admin`;
  const defenderToken = `${prefix}-defender`;
  const attackerToken = `${prefix}-attacker`;

  return cy
    .apiBatchSetup([
      { discord_token: adminToken, role: 'admin' },
      {
        discord_token: defenderToken,
        game_pseudo: `${prefix}Def`.slice(0, 16),
        create_alliance: { name: `${safePrefix(prefix)}Alliance`, tag: safePrefix(prefix).slice(0, 3).toUpperCase() },
        battlegroup: 1,
      },
      {
        discord_token: attackerToken,
        game_pseudo: `${prefix}Atk`.slice(0, 16),
        join_alliance_token: defenderToken,
        battlegroup: 1,
      },
    ])
    .then((users) => {
      const adminAT = users[adminToken].access_token;
      const defData = toUserSetupData(users[defenderToken]);
      const atkData = toUserSetupData(users[attackerToken]);
      const defenderAccId = users[defenderToken].account_id!;
      const attackerAccId = users[attackerToken].account_id!;
      const allianceId = users[defenderToken].alliance_id!;

      // Activate a season so wars created after inherit season_id (required by all_seasons default filter)
      return cy
        .request({
          method: 'POST',
          url: `${BACKEND}/admin/seasons`,
          headers: { Authorization: `Bearer ${adminAT}` },
          body: { number: 1 },
        })
        .then((res) => {
          const seasonId = (res.body as { id: string }).id;
          return cy.request({
            method: 'PATCH',
            url: `${BACKEND}/admin/seasons/${seasonId}/open`,
            headers: { Authorization: `Bearer ${adminAT}` },
            body: {},
          });
        })
        .then(() =>
          // Load champions for both defender and attacker
          cy
            .apiLoadChampions(adminAT, [
              { name: 'Iron Man', cls: 'Tech' },
              { name: 'Captain America', cls: 'Cosmic' },
              { name: 'Spider-Man', cls: 'Science' },
              { name: 'Wolverine', cls: 'Mutant' },
              { name: 'Black Widow', cls: 'Skill' },
              { name: 'Absorbing Man', cls: 'Mystic', has_prefight: true },
            ])
            .then((champMap) =>
              addIronManToRoster(atkData.access_token, attackerAccId, champMap)
                .then((cuIronMan) => addCaptainAmericaToRoster(atkData.access_token, attackerAccId, champMap, cuIronMan))
                .then((data) => addSpiderManToRoster(atkData.access_token, attackerAccId, champMap, data))
                .then((data) => addAbsorbingManToRoster(atkData.access_token, attackerAccId, champMap, data))
                .then((data) =>
                  setupKnowledgeBaseWar(adminAT, defData, atkData, defenderAccId, allianceId, champMap, data),
                ),
            ),
        );
    });
}

// ── Fast knowledge-base setup (dev endpoint, no placement chain) ─────────────

export function setupKnowledgeBaseFast(
  prefix: string,
  count = 2,
): Cypress.Chainable<{
  adminToken: string;
  userData: UserSetupData;
  accountId: string;
  allianceId: string;
}> {
  const adminToken = `${prefix}-admin`;
  const ownerToken = `${prefix}-owner`;

  return cy
    .apiBatchSetup([
      { discord_token: adminToken, role: 'admin' },
      {
        discord_token: ownerToken,
        game_pseudo: `${prefix}Own`.slice(0, 16),
        create_alliance: { name: `${safePrefix(prefix)}Alliance`, tag: safePrefix(prefix).slice(0, 3).toUpperCase() },
        battlegroup: 1,
      },
    ])
    .then((users) => {
      const adminAT = users[adminToken].access_token;
      const ownerData = toUserSetupData(users[ownerToken]);
      const ownerAccId = users[ownerToken].account_id!;
      const allianceId = users[ownerToken].alliance_id!;

      return cy
        .apiLoadChampions(adminAT, [
          { name: 'Iron Man', cls: 'Tech' },
          { name: 'Captain America', cls: 'Cosmic' },
        ])
        .then(() =>
          cy
            .request({
              method: 'POST',
              url: `${BACKEND}/admin/seasons`,
              headers: { Authorization: `Bearer ${adminAT}` },
              body: { number: 1 },
            })
            .then((res) => {
              const seasonId = (res.body as { id: string }).id;
              return cy.apiCreateWar(ownerData.access_token, allianceId, 'OpponentFast').then((war) => {
                cy.apiEndWar(ownerData.access_token, allianceId, war.id, true, 10);
                cy.apiDevBulkCreateFightRecords(war.id, allianceId, ownerAccId, count, seasonId);
                return cy.wrap({ adminToken: adminAT, userData: ownerData, accountId: ownerAccId, allianceId });
              });
            }),
        );
    });
}

type KnowledgeBaseChampMap = Record<string, { id: string }>;

type KnowledgeBaseRoster = {
  cuIronMan: { id: string };
  cu1: { id: string };
  cu2: { id: string };
  cuPrefight: { id: string };
};

function addIronManToRoster(attackerToken: string, attackerAccId: string, champMap: KnowledgeBaseChampMap) {
  return cy.apiAddChampionToRoster(attackerToken, attackerAccId, champMap['Iron Man'].id, '7r3');
}

function addCaptainAmericaToRoster(
  attackerToken: string,
  attackerAccId: string,
  champMap: KnowledgeBaseChampMap,
  cuIronMan: { id: string },
) {
  return cy.apiAddChampionToRoster(attackerToken, attackerAccId, champMap['Captain America'].id, '7r2').then((cu1) => ({
    cuIronMan,
    cu1,
  }));
}

function addSpiderManToRoster(
  attackerToken: string,
  attackerAccId: string,
  champMap: KnowledgeBaseChampMap,
  data: { cuIronMan: { id: string }; cu1: { id: string } },
) {
  return cy.apiAddChampionToRoster(attackerToken, attackerAccId, champMap['Spider-Man'].id, '7r2').then((cu2) => ({
    ...data,
    cu2,
  }));
}

function addAbsorbingManToRoster(
  attackerToken: string,
  attackerAccId: string,
  champMap: KnowledgeBaseChampMap,
  data: { cuIronMan: { id: string }; cu1: { id: string }; cu2: { id: string } },
) {
  return cy
    .apiAddChampionToRoster(attackerToken, attackerAccId, champMap['Absorbing Man'].id, '6r4')
    .then((cuPrefight) => ({
      ...data,
      cuPrefight,
    }));
}

function setupKnowledgeBaseWar(
  adminToken: string,
  defData: UserSetupData,
  atkData: UserSetupData,
  defenderAccId: string,
  allianceId: string,
  champMap: KnowledgeBaseChampMap,
  data: KnowledgeBaseRoster,
) {
  return cy.apiCreateWar(defData.access_token, allianceId, 'OpponentA').then((war) => {
    cy.apiPlaceWarDefender(defData.access_token, allianceId, war.id, 1, 1, champMap['Iron Man'].id, 7, 3, 0);
    cy.apiPlaceWarDefender(defData.access_token, allianceId, war.id, 1, 2, champMap['Captain America'].id, 6, 2, 0);
    cy.apiPlaceWarDefender(defData.access_token, allianceId, war.id, 1, 3, champMap['Spider-Man'].id, 6, 2, 0);
    console.log('Defenders placed, now assigning attackers');
    cy.apiAssignWarAttacker(atkData.access_token, allianceId, war.id, 1, 1, data.cu1.id);
    console.log('Assigned Captain America to node 1');
    cy.apiAssignWarAttacker(atkData.access_token, allianceId, war.id, 1, 2, data.cu2.id);
    console.log('Assigned Spider Man to node 2');
    cy.apiAddWarSynergy(atkData.access_token, allianceId, war.id, 1, data.cuIronMan.id, data.cu1.id);
    console.log('Added synergy between Iron Man and Captain America');
    cy.apiUpdateWarKo(defData.access_token, allianceId, war.id, 1, 1, 2);
    cy.apiUpdateWarKo(defData.access_token, allianceId, war.id, 1, 2, 1);
    return cy.apiEndWar(defData.access_token, allianceId, war.id, true, 10).then(() => ({
      adminToken,
      userData: defData,
      atkData,
      accountId: defenderAccId,
      allianceId,
    }));
  });
}

// ── Mastery commands ──────────────────────────────────────────────────────────

Cypress.Commands.add('apiCreateMastery', (_adminToken: string, name: string, maxValue: number, order: number) => {
  return cy
    .request({
      method: 'POST',
      url: `${BACKEND}/dev/masteries`,
      body: { name, max_value: maxValue, order },
    })
    .then((res) => res.body);
});

Cypress.Commands.add(
  'apiSaveMasteries',
  (
    token: string,
    accountId: string,
    items: { mastery_id: string; unlocked: number; attack: number; defense: number }[],
  ) => {
    return cy
      .request({
        method: 'PUT',
        url: `${BACKEND}/game-accounts/${accountId}/masteries`,
        headers: { Authorization: `Bearer ${token}` },
        body: items,
      })
      .then((res) => res.body);
  },
);

// ── Create upgrade request (direct backend call) ──────────────────────────────

Cypress.Commands.add('apiCreateUpgradeRequest', (token: string, championUserId: string, requestedRarity: string) => {
  return cy
    .request({
      method: 'POST',
      url: `${BACKEND}/champion-users/upgrade-requests`,
      headers: { Authorization: `Bearer ${token}` },
      body: { champion_user_id: championUserId, requested_rarity: requestedRarity },
    })
    .then((res) => res.body);
});

// ── Upgrade champion rank (direct backend call) ───────────────────────────────

Cypress.Commands.add('apiUpgradeChampion', (token: string, championUserId: string) => {
  return cy
    .request({
      method: 'PATCH',
      url: `${BACKEND}/champion-users/${championUserId}/upgrade`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((res) => res.body);
});

// ── Helper: extract UserSetupData from a BatchSetupUserResult ────────────────

function toUserSetupData(r: BatchSetupUserResult): UserSetupData {
  return {
    access_token: r.access_token,
    refresh_token: r.refresh_token,
    user_id: r.user_id,
    login: r.login,
    email: r.email,
    discord_id: r.discord_id,
  };
}

// ── Setup helpers (all use /dev/batch-setup — 1 request instead of N) ────────

export function setupAdmin(discordToken = 'cypress-admin-token'): Cypress.Chainable<UserSetupData> {
  return cy
    .apiBatchSetup([{ discord_token: discordToken, role: 'admin' }])
    .then((users) => toUserSetupData(users[discordToken]));
}

export function setupUser(discordToken = 'cypress-test-token'): Cypress.Chainable<UserSetupData> {
  return cy.apiBatchSetup([{ discord_token: discordToken }]).then((users) => toUserSetupData(users[discordToken]));
}
export function setupRosterUser(
  tokenPrefix: string,
  pseudo: string,
): Cypress.Chainable<{ adminData: UserSetupData; userData: UserSetupData; accountId: string }> {
  const adminToken = `${tokenPrefix}-admin`;
  const userToken = `${tokenPrefix}-user`;
  return cy
    .apiBatchSetup([
      { discord_token: adminToken, role: 'admin' },
      { discord_token: userToken, game_pseudo: pseudo },
    ])
    .then((users) => ({
      adminData: toUserSetupData(users[adminToken]),
      userData: toUserSetupData(users[userToken]),
      accountId: users[userToken].account_id!,
    }));
}
export function setupAllianceOwner(
  tokenPrefix: string,
  pseudo: string,
  allianceName: string,
  allianceTag: string,
): Cypress.Chainable<{ userData: UserSetupData; accountId: string; allianceId: string }> {
  const ownerToken = `${tokenPrefix}-owner`;
  return cy
    .apiBatchSetup([
      {
        discord_token: ownerToken,
        game_pseudo: pseudo,
        create_alliance: { name: allianceName, tag: allianceTag },
      },
    ])
    .then((users) => {
      const r = users[ownerToken];
      return { userData: toUserSetupData(r), accountId: r.account_id!, allianceId: r.alliance_id! };
    });
}

export function setupDefenseOwnerAndMember(
  tokenPrefix: string,
  ownerPseudo: string,
  memberPseudo: string,
  allianceName: string,
  allianceTag: string,
): Cypress.Chainable<{
  adminData: UserSetupData;
  ownerData: UserSetupData;
  memberData: UserSetupData;
  allianceId: string;
  ownerAccId: string;
  memberAccId: string;
}> {
  const adminToken = `${tokenPrefix}-admin`;
  const ownerToken = `${tokenPrefix}-owner`;
  const memberToken = `${tokenPrefix}-member`;
  return cy
    .apiBatchSetup([
      { discord_token: adminToken, role: 'admin' },
      {
        discord_token: ownerToken,
        game_pseudo: ownerPseudo,
        create_alliance: { name: allianceName, tag: allianceTag },
        battlegroup: 1,
      },
      {
        discord_token: memberToken,
        game_pseudo: memberPseudo,
        join_alliance_token: ownerToken,
        battlegroup: 1,
      },
    ])
    .then((users) => ({
      adminData: toUserSetupData(users[adminToken]),
      ownerData: toUserSetupData(users[ownerToken]),
      memberData: toUserSetupData(users[memberToken]),
      allianceId: users[ownerToken].alliance_id!,
      ownerAccId: users[ownerToken].account_id!,
      memberAccId: users[memberToken].account_id!,
    }));
}

export type ChampDef = {
  name: string;
  cls: string;
  rarity: string;
  options?: {
    signature?: number;
    is_preferred_attacker?: boolean;
    ascension?: number;
    is_ascendable?: boolean;
  };
};

export function setupDefenseOwner(
  tokenPrefix: string,
  pseudo: string,
  allianceName: string,
  allianceTag: string,
): Cypress.Chainable<{
  adminData: UserSetupData;
  ownerData: UserSetupData;
  allianceId: string;
  ownerAccId: string;
}> {
  const adminToken = `${tokenPrefix}-admin`;
  const ownerToken = `${tokenPrefix}-owner`;
  return cy
    .apiBatchSetup([
      { discord_token: adminToken, role: 'admin' },
      {
        discord_token: ownerToken,
        game_pseudo: pseudo,
        create_alliance: { name: allianceName, tag: allianceTag },
        battlegroup: 1,
      },
    ])
    .then((users) => ({
      adminData: toUserSetupData(users[adminToken]),
      ownerData: toUserSetupData(users[ownerToken]),
      allianceId: users[ownerToken].alliance_id!,
      ownerAccId: users[ownerToken].account_id!,
    }));
}

export function setupDefenseScenario(
  prefix: string,
  pseudo: string,
  tag: string,
  champDefs: ChampDef[],
): Cypress.Chainable<{
  adminData: UserSetupData;
  ownerData: UserSetupData;
  allianceId: string;
  ownerAccId: string;
  championUsers: { name: string; cuId: string }[];
}> {
  return setupDefenseOwner(prefix, pseudo, `${tag}All`, tag).then(
    ({ adminData, ownerData, allianceId, ownerAccId }) => {
      const championUsers: { name: string; cuId: string }[] = [];
      return cy
        .apiLoadChampions(
          adminData.access_token,
          champDefs.map((d) => ({ name: d.name, cls: d.cls, is_ascendable: d.options?.is_ascendable })),
        )
        .then((champMap) => {
          for (const def of champDefs) {
            cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champMap[def.name].id, def.rarity, {
              signature: def.options?.signature ?? 0,
              is_preferred_attacker: def.options?.is_preferred_attacker ?? false,
              ascension: def.options?.ascension ?? 0,
            }).then((cu) => {
              championUsers.push({ name: def.name, cuId: cu.id });
            });
          }
        })
        .then(() => ({ adminData, ownerData, allianceId, ownerAccId, championUsers }));
    },
  );
}

export function setupOwnerMemberAlliance(
  tokenPrefix: string,
  ownerPseudo: string,
  memberPseudo: string,
  allianceName: string,
  allianceTag: string,
): Cypress.Chainable<{
  ownerData: UserSetupData;
  memberData: UserSetupData;
  allianceId: string;
  ownerAccId: string;
  memberAccId: string;
}> {
  const ownerToken = `${tokenPrefix}-owner`;
  const memberToken = `${tokenPrefix}-member`;
  return cy
    .apiBatchSetup([
      {
        discord_token: ownerToken,
        game_pseudo: ownerPseudo,
        create_alliance: { name: allianceName, tag: allianceTag },
      },
      {
        discord_token: memberToken,
        game_pseudo: memberPseudo,
        join_alliance_token: ownerToken,
      },
    ])
    .then((users) => ({
      ownerData: toUserSetupData(users[ownerToken]),
      memberData: toUserSetupData(users[memberToken]),
      allianceId: users[ownerToken].alliance_id!,
      ownerAccId: users[ownerToken].account_id!,
      memberAccId: users[memberToken].account_id!,
    }));
}

/**
 * Helper: create an alliance with an owner and a member using force-join.
 * Also loads a champion and adds it to the member's roster at 7r1.
 */
export function setupAllianceWithMember(
  tokenPrefix: string,
  championName: string,
  championClass: string,
): Cypress.Chainable<{
  ownerData: UserSetupData;
  memberData: UserSetupData;
  allianceId: string;
  memberAccId: string;
  champId: string;
  championUserId: string;
}> {
  const adminToken = `${tokenPrefix}-admin`;
  const ownerToken = `${tokenPrefix}-owner`;
  const memberToken = `${tokenPrefix}-member`;

  return cy
    .apiBatchSetup([
      { discord_token: adminToken, role: 'admin' },
      {
        discord_token: ownerToken,
        game_pseudo: `${tokenPrefix}Owner`.slice(0, 16),
        create_alliance: {
          name: `${safePrefix(tokenPrefix)}Alliance`,
          tag: safePrefix(tokenPrefix).slice(0, 3).toUpperCase(),
        },
      },
      {
        discord_token: memberToken,
        game_pseudo: `${tokenPrefix}Member`.slice(0, 16),
      },
    ])
    .then((users) => {
      const adminAT = users[adminToken].access_token;
      const ownerData = toUserSetupData(users[ownerToken]);
      const memberData = toUserSetupData(users[memberToken]);
      const allianceId = users[ownerToken].alliance_id!;
      const memberAccId = users[memberToken].account_id!;

      // Force-join member to alliance
      cy.apiForceJoinAlliance(memberAccId, allianceId);

      // Load the champion
      return cy.apiLoadChampion(adminAT, championName, championClass).then((champs) => {
        const champId = champs[0].id;

        // Add champion to member's roster at 7r1
        return cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champId, '7r1').then((cu) => ({
          ownerData,
          memberData,
          allianceId,
          memberAccId,
          champId,
          championUserId: cu.id as string,
        }));
      });
    });
}

// ── War API commands ──────────────────────────────────────────────────────────

Cypress.Commands.add(
  'apiCreateWar',
  (token: string, allianceId: string, opponentName: string, bannedChampionIds: string[] = []) => {
    cy.request({
      method: 'POST',
      url: `${BACKEND}/alliances/${allianceId}/wars`,
      headers: { Authorization: `Bearer ${token}` },
      body: { opponent_name: opponentName, banned_champion_ids: bannedChampionIds },
    }).then((res) => {
      expect(res.status).to.eq(201);
      return res.body;
    });
  },
);

Cypress.Commands.add(
  'apiPlaceWarDefender',
  (
    token: string,
    allianceId: string,
    warId: string,
    battlegroup: number,
    nodeNumber: number,
    championId: string,
    stars: number,
    rank: number,
    ascension = 0,
  ) => {
    cy.request({
      method: 'POST',
      url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/place`,
      headers: { Authorization: `Bearer ${token}` },
      body: { node_number: nodeNumber, champion_id: championId, stars, rank, ascension },
    }).then((res) => {
      expect(res.status).to.eq(201);
      return res.body;
    });
  },
);

Cypress.Commands.add(
  'apiRemoveWarDefender',
  (token: string, allianceId: string, warId: string, battlegroup: number, nodeNumber: number) => {
    cy.request({
      method: 'DELETE',
      url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      expect(res.status).to.eq(204);
    });
  },
);

Cypress.Commands.add(
  'apiAssignWarAttacker',
  (
    token: string,
    allianceId: string,
    warId: string,
    battlegroup: number,
    nodeNumber: number,
    championUserId: string,
  ) => {
    cy.request({
      method: 'POST',
      url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/attacker`,
      headers: { Authorization: `Bearer ${token}` },
      body: { champion_user_id: championUserId },
    }).then((res) => {
      expect(res.status).to.eq(200);
      return res.body;
    });
  },
);

Cypress.Commands.add(
  'apiRemoveWarAttacker',
  (token: string, allianceId: string, warId: string, battlegroup: number, nodeNumber: number) => {
    cy.request({
      method: 'DELETE',
      url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/attacker`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      expect(res.status).to.eq(200);
      return res.body;
    });
  },
);

Cypress.Commands.add(
  'apiUpdateWarKo',
  (token: string, allianceId: string, warId: string, battlegroup: number, nodeNumber: number, koCount: number) => {
    cy.request({
      method: 'PATCH',
      url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/ko`,
      headers: { Authorization: `Bearer ${token}` },
      body: { ko_count: koCount },
    }).then((res) => {
      expect(res.status).to.eq(200);
      return res.body;
    });
  },
);

Cypress.Commands.add(
  'apiToggleCombatCompleted',
  (token: string, allianceId: string, warId: string, battlegroup: number, nodeNumber: number) => {
    cy.request({
      method: 'PATCH',
      url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/complete`,
      headers: { Authorization: `Bearer ${token}` },
      body: {},
    }).then((res) => {
      expect(res.status).to.eq(200);
      return res.body;
    });
  },
);

Cypress.Commands.add(
  'apiToggleFightNotDone',
  (token: string, allianceId: string, warId: string, battlegroup: number, nodeNumber: number) => {
    cy.request({
      method: 'PATCH',
      url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/fight-not-done`,
      headers: { Authorization: `Bearer ${token}` },
      body: {},
    }).then((res) => {
      expect(res.status).to.eq(200);
      return res.body;
    });
  },
);

Cypress.Commands.add(
  'apiTogglePlanningError',
  (token: string, allianceId: string, warId: string, battlegroup: number, nodeNumber: number) => {
    cy.request({
      method: 'PATCH',
      url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/planning-error`,
      headers: { Authorization: `Bearer ${token}` },
      body: {},
    }).then((res) => {
      expect(res.status).to.eq(200);
      return res.body;
    });
  },
);

Cypress.Commands.add('apiEndWar', (token: string, allianceId: string, warId: string, win = true, eloChange = 10) => {
  cy.request({
    method: 'POST',
    url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/end`,
    headers: { Authorization: `Bearer ${token}` },
    body: { win, elo_change: eloChange },
  }).then((res) => {
    expect(res.status).to.eq(200);
    return res.body;
  });
});

Cypress.Commands.add(
  'apiAddWarSynergy',
  (
    token: string,
    allianceId: string,
    warId: string,
    battlegroup: number,
    championUserId: string,
    targetChampionUserId: string,
  ) => {
    cy.request({
      method: 'POST',
      url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/synergy`,
      headers: { Authorization: `Bearer ${token}` },
      body: { champion_user_id: championUserId, target_champion_user_id: targetChampionUserId },
    }).then((res) => {
      expect(res.status).to.eq(201);
      return res.body;
    });
  },
);

Cypress.Commands.add(
  'apiRemoveWarSynergy',
  (token: string, allianceId: string, warId: string, battlegroup: number, championUserId: string) => {
    cy.request({
      method: 'DELETE',
      url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/synergy/${championUserId}`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      expect(res.status).to.eq(204);
    });
  },
);

// ── Prefight API commands ─────────────────────────────────────────────────────

Cypress.Commands.add(
  'apiAddWarPrefight',
  (
    token: string,
    allianceId: string,
    warId: string,
    battlegroup: number,
    championUserId: string,
    targetNodeNumber: number,
  ) => {
    return cy.request({
      method: 'POST',
      url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/prefight`,
      headers: { Authorization: `Bearer ${token}` },
      body: { champion_user_id: championUserId, target_node_number: targetNodeNumber },
    });
  },
);

Cypress.Commands.add(
  'apiRemoveWarPrefight',
  (token: string, allianceId: string, warId: string, battlegroup: number, championUserId: string) => {
    return cy.request({
      method: 'DELETE',
      url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/prefight/${championUserId}`,
      headers: { Authorization: `Bearer ${token}` },
    });
  },
);

// ── Navigation helpers ────────────────────────────────────────────────────────

Cypress.Commands.add('goToAdminChampionsTab', () => {
  cy.navTo('admin');
  cy.getByCy('tab-champions').click();
});

Cypress.Commands.add('goToWarMode', (userId: string, mode: 'defenders' | 'attackers') => {
  cy.apiLogin(userId);
  cy.navTo('war');
  cy.getByCy(`war-mode-${mode}`).click();
});

Cypress.Commands.add('goToAllianceStatsTab', () => {
  cy.navTo('alliances');
  cy.getByCy('tab-statistics').click();
});

// ── War setup helper ──────────────────────────────────────────────────────────

export function setupWarOwner(
  tokenPrefix: string,
  ownerPseudo: string,
  allianceName: string,
  allianceTag: string,
): Cypress.Chainable<{
  adminData: UserSetupData;
  ownerData: UserSetupData;
  allianceId: string;
  ownerAccId: string;
}> {
  const adminToken = `${tokenPrefix}-admin`;
  const ownerToken = `${tokenPrefix}-owner`;
  return cy
    .apiBatchSetup([
      { discord_token: adminToken, role: 'admin' },
      {
        discord_token: ownerToken,
        game_pseudo: ownerPseudo,
        create_alliance: { name: allianceName, tag: allianceTag },
      },
    ])
    .then((users) => ({
      adminData: toUserSetupData(users[adminToken]),
      ownerData: toUserSetupData(users[ownerToken]),
      allianceId: users[ownerToken].alliance_id!,
      ownerAccId: users[ownerToken].account_id!,
    }));
}

export function setupAttackerScenario(prefix: string): Cypress.Chainable<{
  adminToken: string;
  ownerData: UserSetupData;
  memberData: UserSetupData;
  allianceId: string;
  ownerAccId: string;
  memberAccId: string;
  warId: string;
  championUserId: string;
}> {
  const adminToken = `${prefix}-admin`;
  const ownerToken = `${prefix}-owner`;
  const memberToken = `${prefix}-member`;

  return cy
    .apiBatchSetup([
      { discord_token: adminToken, role: 'admin' },
      {
        discord_token: ownerToken,
        game_pseudo: `${prefix}Owner`.slice(0, 16),
        create_alliance: { name: `${safePrefix(prefix)}Alliance`, tag: safePrefix(prefix).slice(0, 3).toUpperCase() },
        battlegroup: 1,
      },
      {
        discord_token: memberToken,
        game_pseudo: `${prefix}Member`.slice(0, 16),
        join_alliance_token: ownerToken,
        battlegroup: 1,
      },
    ])
    .then((users) => {
      const adminAT = users[adminToken].access_token;
      const ownerData = toUserSetupData(users[ownerToken]);
      const memberData = toUserSetupData(users[memberToken]);
      const allianceId = users[ownerToken].alliance_id!;
      const ownerAccId = users[ownerToken].account_id!;
      const memberAccId = users[memberToken].account_id!;

      return cy
        .apiLoadChampions(adminAT, [
          { name: 'Iron Man', cls: 'Tech' },
          { name: 'Wolverine', cls: 'Mutant' },
        ])
        .then((champMap) => {
          let savedWarId = '';
          cy.apiCreateWar(ownerData.access_token, allianceId, 'AttackerEnemy').then((war) => {
            savedWarId = war.id;
            cy.apiPlaceWarDefender(ownerData.access_token, allianceId, war.id, 1, 10, champMap['Iron Man'].id, 7, 3, 0);
          });
          return cy
            .apiAddChampionToRoster(memberData.access_token, memberAccId, champMap['Wolverine'].id, '7r3')
            .then((cu) => ({
              adminToken: adminAT,
              ownerData,
              memberData,
              allianceId,
              ownerAccId,
              memberAccId,
              warId: savedWarId,
              championUserId: cu.id,
            }));
        });
    });
}

export function setupVisitorScenario(prefix: string): Cypress.Chainable<{
  ownerData: UserSetupData;
  visitorData: UserSetupData;
  ownerAccId: string;
  visitorAccId: string;
  allianceId: string;
}> {
  const ownerToken = `${prefix}-owner`;
  const visitorToken = `${prefix}-visitor`;
  return cy
    .apiBatchSetup([
      {
        discord_token: ownerToken,
        game_pseudo: `${prefix}Owner`.slice(0, 16),
        create_alliance: { name: `${safePrefix(prefix)}Alliance`, tag: safePrefix(prefix).slice(0, 3).toUpperCase() },
      },
      {
        discord_token: visitorToken,
        game_pseudo: `${prefix}Visitor`.slice(0, 16),
      },
    ])
    .then((users) => {
      const ownerData = toUserSetupData(users[ownerToken]);
      const visitorData = toUserSetupData(users[visitorToken]);
      const ownerAccId = users[ownerToken].account_id!;
      const visitorAccId = users[visitorToken].account_id!;
      const allianceId = users[ownerToken].alliance_id!;
      return cy
        .request({
          method: 'POST',
          url: `${BACKEND}/alliances/${allianceId}/invitations`,
          headers: { Authorization: `Bearer ${ownerData.access_token}` },
          body: { game_account_id: visitorAccId, type: 'visitor' },
        })
        .then((invResp) => {
          const invId = (invResp.body as { id: string }).id;
          return cy
            .request({
              method: 'POST',
              url: `${BACKEND}/alliances/invitations/${invId}/accept`,
              headers: { Authorization: `Bearer ${visitorData.access_token}` },
              body: {},
            })
            .then(() => ({ ownerData, visitorData, ownerAccId, visitorAccId, allianceId }));
        });
    });
}

export function setupPrefightScenario(prefix: string): Cypress.Chainable<{
  adminToken: string;
  ownerData: UserSetupData;
  memberData: UserSetupData;
  allianceId: string;
  ownerAccId: string;
  memberAccId: string;
  warId: string;
  championUserId: string;
  prefightChampionUserId: string;
}> {
  return setupAttackerScenario(prefix).then((scenario) => {
    return cy.apiLoadChampion(scenario.adminToken, 'Storm', 'Mutant').then((champs: { id: string }[]) => {
      const stormId = champs[0].id;
      cy.request({
        method: 'PATCH',
        url: `${BACKEND}/admin/champions/${stormId}/prefight`,
        headers: { Authorization: `Bearer ${scenario.adminToken}` },
      });
      return cy
        .request({
          method: 'POST',
          url: `${BACKEND}/champion-users`,
          headers: { Authorization: `Bearer ${scenario.memberData.access_token}` },
          body: {
            champion_id: stormId,
            game_account_id: scenario.memberAccId,
            stars: 6,
            rank: 3,
            ascension: 0,
            rarity: '7r3',
          },
        })
        .then((resp: Cypress.Response<{ id: string }>) => ({
          ...scenario,
          prefightChampionUserId: resp.body.id,
        }));
    });
  });
}
