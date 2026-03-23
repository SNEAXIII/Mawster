/// <reference types="cypress" />

// Suppress benign ResizeObserver errors that occur in some browsers
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('ResizeObserver')) return false;
});

// Remove the default 10ms per-keystroke delay globally
Cypress.Commands.overwrite<'type', 'element'>('type', (originalFn, subject, text, options) => {
  return originalFn(subject, text, { delay: 0, ...options });
});

export const BACKEND: string =
  (Cypress.env('backendUrl') as string | undefined) ?? 'http://localhost:8001';

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
  cy.request('POST', `${BACKEND}/dev/truncate`).then((res) => {
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
    options: { is_ascendable?: boolean } = {}
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
        },
      ],
    }).then((res) => {
      expect(res.status).to.eq(200);
      // Load endpoint doesn't return champion objects, so fetch them
      return cy
        .request({
          method: 'GET',
          url: `${BACKEND}/champions?search=${encodeURIComponent(name)}`,
          headers: { Authorization: `Bearer ${adminToken}` },
        })
        .then((getRes) => getRes.body.champions);
    });
  }
);

// ── Create alliance (direct backend call) ────────────────────────────────────

Cypress.Commands.add(
  'apiCreateAlliance',
  (token: string, name: string, tag: string, ownerId: string) => {
    cy.request({
      method: 'POST',
      url: `${BACKEND}/alliances`,
      headers: { Authorization: `Bearer ${token}` },
      body: { name, tag, owner_id: ownerId },
    }).then((res) => {
      expect(res.status).to.eq(201);
      return res.body;
    });
  }
);

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

// Pages where cy.visit is preferred over nav click (avoids Radix scroll-lock contamination
// across tests, or pages that have no nav link)
const NAV_URL_FALLBACK: Record<string, string> = {
  defense: '/game/defense',
  war: '/game/war',
};

Cypress.Commands.add('navTo', (page: string) => {
  const fallback = NAV_URL_FALLBACK[page];
  if (fallback) {
    cy.visit(fallback);
  } else {
    cy.getByCy(`nav-${page}`).click();
  }
});

// ── Invite member to alliance (direct backend call) ─────────────────────────

Cypress.Commands.add(
  'apiInviteMember',
  (token: string, allianceId: string, gameAccountId: string) => {
    cy.request({
      method: 'POST',
      url: `${BACKEND}/alliances/${allianceId}/invitations`,
      headers: { Authorization: `Bearer ${token}` },
      body: { game_account_id: gameAccountId },
    }).then((res) => {
      expect(res.status).to.eq(201);
      return res.body;
    });
  }
);

// ── Add champion to player roster (direct backend call) ─────────────────────

Cypress.Commands.add(
  'apiAddChampionToRoster',
  (
    token: string,
    gameAccountId: string,
    championId: string,
    rarity: string,
    options: { signature?: number; is_preferred_attacker?: boolean; ascension?: number } = {}
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
  }
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
    gameAccountId: string
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
  }
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
  }
);

// ── Add officer to alliance (direct backend call) ───────────────────────────

Cypress.Commands.add(
  'apiAddOfficer',
  (token: string, allianceId: string, gameAccountId: string) => {
    cy.request({
      method: 'POST',
      url: `${BACKEND}/alliances/${allianceId}/officers`,
      headers: { Authorization: `Bearer ${token}` },
      body: { game_account_id: gameAccountId },
    }).then((res) => {
      expect(res.status).to.eq(201);
      return res.body;
    });
  }
)

// ── Run fixtures (truncate DB + seed) ────────────────────────────────────────

Cypress.Commands.add('runFixtures', () => {
  cy.request('POST', `${BACKEND}/dev/fixtures`);
})

// ── Create upgrade request (direct backend call) ──────────────────────────────

Cypress.Commands.add(
  'apiCreateUpgradeRequest',
  (token: string, championUserId: string, requestedRarity: string) => {
    return cy
      .request({
        method: 'POST',
        url: `${BACKEND}/champion-users/upgrade-requests`,
        headers: { Authorization: `Bearer ${token}` },
        body: { champion_user_id: championUserId, requested_rarity: requestedRarity },
      })
      .then((res) => res.body);
  }
)

// ── Upgrade champion rank (direct backend call) ───────────────────────────────

Cypress.Commands.add('apiUpgradeChampion', (token: string, championUserId: string) => {
  return cy
    .request({
      method: 'PATCH',
      url: `${BACKEND}/champion-users/${championUserId}/upgrade`,
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((res) => res.body);
})

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
  return cy
    .apiBatchSetup([{ discord_token: discordToken }])
    .then((users) => toUserSetupData(users[discordToken]));
}

export function setupAllianceOwner(
  tokenPrefix: string,
  pseudo: string,
  allianceName: string,
  allianceTag: string
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

export function setupRosterUser(
  tokenPrefix: string,
  pseudo: string
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

export function setupDefenseOwner(
  tokenPrefix: string,
  pseudo: string,
  allianceName: string,
  allianceTag: string
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

export function setupDefenseOwnerAndMember(
  tokenPrefix: string,
  ownerPseudo: string,
  memberPseudo: string,
  allianceName: string,
  allianceTag: string
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

export function setupOwnerMemberAlliance(
  tokenPrefix: string,
  ownerPseudo: string,
  memberPseudo: string,
  allianceName: string,
  allianceTag: string
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

// ── War API commands ──────────────────────────────────────────────────────────

Cypress.Commands.add('apiCreateWar', (token: string, allianceId: string, opponentName: string) => {
  cy.request({
    method: 'POST',
    url: `${BACKEND}/alliances/${allianceId}/wars`,
    headers: { Authorization: `Bearer ${token}` },
    body: { opponent_name: opponentName },
  }).then((res) => {
    expect(res.status).to.eq(201);
    return res.body;
  });
});

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
    ascension = 0
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
  }
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
  }
);

Cypress.Commands.add(
  'apiAssignWarAttacker',
  (
    token: string,
    allianceId: string,
    warId: string,
    battlegroup: number,
    nodeNumber: number,
    championUserId: string
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
  }
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
  }
);

Cypress.Commands.add(
  'apiUpdateWarKo',
  (
    token: string,
    allianceId: string,
    warId: string,
    battlegroup: number,
    nodeNumber: number,
    koCount: number
  ) => {
    cy.request({
      method: 'PATCH',
      url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/${battlegroup}/node/${nodeNumber}/ko`,
      headers: { Authorization: `Bearer ${token}` },
      body: { ko_count: koCount },
    }).then((res) => {
      expect(res.status).to.eq(200);
      return res.body;
    });
  }
);

Cypress.Commands.add('apiEndWar', (token: string, allianceId: string, warId: string) => {
  cy.request({
    method: 'POST',
    url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/end`,
    headers: { Authorization: `Bearer ${token}` },
    body: {},
  }).then((res) => {
    expect(res.status).to.eq(200);
    return res.body;
  });
});

// ── War setup helper ──────────────────────────────────────────────────────────

export function setupWarOwner(
  tokenPrefix: string,
  ownerPseudo: string,
  allianceName: string,
  allianceTag: string
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
