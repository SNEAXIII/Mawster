/// <reference types="cypress" />

// Suppress benign ResizeObserver errors that occur in some browsers
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('ResizeObserver')) return false;
});

export const BACKEND = 'http://localhost:8001';

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

// Pages that no longer have a nav link — navigate via URL instead
const NAV_URL_FALLBACK: Record<string, string> = {
  defense: '/game/defense',
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
);

// ── Run fixtures (truncate DB + seed) ────────────────────────────────────────

Cypress.Commands.add('runFixtures', () => {
  cy.request('POST', `${BACKEND}/dev/fixtures`);
});

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
);

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

// ── Helper: register + promote via API, returns user data ────────────────────

function getProfile(
  accessToken: string
): Cypress.Chainable<{ id: string; login: string; email: string; discord_id: string }> {
  // Decode user_id from JWT since /auth/session doesn't include it
  const payload = JSON.parse(atob(accessToken.split('.')[1]));
  const userId: string = payload.user_id;

  return cy
    .request({
      method: 'GET',
      url: `${BACKEND}/auth/session`,
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .then((res) => ({
      id: userId,
      login: res.body.login,
      email: res.body.email,
      discord_id: res.body.discord_id,
    }));
}

export function setupAdmin(discordToken = 'cypress-admin-token'): Cypress.Chainable<UserSetupData> {
  let profile: { id: string; login: string; email: string; discord_id: string };

  return cy
    .registerUser(discordToken)
    .then((tokens) => getProfile(tokens.access_token))
    .then((p) => {
      profile = p;
      return cy.request({
        method: 'POST',
        url: `${BACKEND}/dev/promote`,
        body: { user_id: profile.id, role: 'admin' },
      });
    })
    .then(() =>
      cy.request({
        method: 'POST',
        url: `${BACKEND}/dev/login`,
        body: { user_id: profile.id },
      })
    )
    .then((loginRes) => ({
      access_token: loginRes.body.access_token,
      refresh_token: loginRes.body.refresh_token,
      user_id: profile.id,
      login: profile.login,
      email: profile.email,
      discord_id: profile.discord_id,
    }));
}

// ── Helper: register a regular user via API, returns user data ───────────────

export function setupUser(discordToken = 'cypress-test-token'): Cypress.Chainable<UserSetupData> {
  return cy.registerUser(discordToken).then((tokens) => {
    return getProfile(tokens.access_token).then((profile) => ({
      ...tokens,
      user_id: profile.id,
      login: profile.login,
      email: profile.email,
      discord_id: profile.discord_id,
    }));
  });
}

// ── Helper: user + game account + alliance (no admin, no BG) ─────────────────

export function setupAllianceOwner(
  tokenPrefix: string,
  pseudo: string,
  allianceName: string,
  allianceTag: string
): Cypress.Chainable<{
  userData: UserSetupData;
  accountId: string;
  allianceId: string;
}> {
  let userData: UserSetupData;
  let accountId: string;
  let allianceId: string;

  return setupUser(`${tokenPrefix}-owner`)
    .then((user) => {
      userData = user;
      return cy.apiCreateGameAccount(user.access_token, pseudo, true);
    })
    .then((acc) => {
      accountId = acc.id;
      return cy.apiCreateAlliance(userData.access_token, allianceName, allianceTag, accountId);
    })
    .then((alliance) => {
      allianceId = alliance.id;
    })
    .then(() => ({ userData, accountId, allianceId }));
}

// ── Helper: admin + user + game account (no alliance) ────────────────────────

export function setupRosterUser(
  tokenPrefix: string,
  pseudo: string
): Cypress.Chainable<{
  adminData: UserSetupData;
  userData: UserSetupData;
  accountId: string;
}> {
  let adminData: UserSetupData;
  let userData: UserSetupData;

  return setupAdmin(`${tokenPrefix}-admin`)
    .then((admin) => {
      adminData = admin;
      return setupUser(`${tokenPrefix}-user`);
    })
    .then((user) => {
      userData = user;
      return cy.apiCreateGameAccount(user.access_token, pseudo, true);
    })
    .then((acc) => ({ adminData, userData, accountId: acc.id }));
}

// ── Helper: admin + owner with game account, alliance and BG1 ────────────────

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
  let adminData: UserSetupData;
  let ownerData: UserSetupData;
  let allianceId: string;
  let ownerAccId: string;

  return setupAdmin(`${tokenPrefix}-admin`)
    .then((admin) => {
      adminData = admin;
      return setupUser(`${tokenPrefix}-owner`);
    })
    .then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, pseudo, true);
    })
    .then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, allianceName, allianceTag, ownerAccId);
    })
    .then((alliance) => {
      allianceId = alliance.id;
      return cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
    })
    .then(() => ({ adminData, ownerData, allianceId, ownerAccId }));
}

// ── Helper: admin + owner + member, both assigned to BG1 ─────────────────────

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
  let adminData: UserSetupData;
  let ownerData: UserSetupData;
  let memberData: UserSetupData;
  let allianceId: string;
  let ownerAccId: string;
  let memberAccId: string;

  return setupAdmin(`${tokenPrefix}-admin`)
    .then((admin) => {
      adminData = admin;
      return setupUser(`${tokenPrefix}-owner`);
    })
    .then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, ownerPseudo, true);
    })
    .then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, allianceName, allianceTag, ownerAccId);
    })
    .then((alliance) => {
      allianceId = alliance.id;
      return cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
    })
    .then(() => setupUser(`${tokenPrefix}-member`))
    .then((member) => {
      memberData = member;
      return cy.apiCreateGameAccount(member.access_token, memberPseudo, true);
    })
    .then((memberAcc) => {
      memberAccId = memberAcc.id;
      cy.apiForceJoinAlliance(memberAccId, allianceId);
      return cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 1);
    })
    .then(() => ({ adminData, ownerData, memberData, allianceId, ownerAccId, memberAccId }));
}

// ── Helper: owner + member force-joined (no admin, no BG assignment) ─────────

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
  let ownerData: UserSetupData;
  let memberData: UserSetupData;
  let allianceId: string;
  let ownerAccId: string;
  let memberAccId: string;

  return setupUser(`${tokenPrefix}-owner`)
    .then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, ownerPseudo, true);
    })
    .then((ownerAcc) => {
      ownerAccId = ownerAcc.id;
      return cy.apiCreateAlliance(ownerData.access_token, allianceName, allianceTag, ownerAccId);
    })
    .then((alliance) => {
      allianceId = alliance.id;
      return setupUser(`${tokenPrefix}-member`);
    })
    .then((member) => {
      memberData = member;
      return cy.apiCreateGameAccount(member.access_token, memberPseudo, true);
    })
    .then((memberAcc) => {
      memberAccId = memberAcc.id;
      return cy.apiForceJoinAlliance(memberAccId, allianceId);
    })
    .then(() => ({ ownerData, memberData, allianceId, ownerAccId, memberAccId }));
}
