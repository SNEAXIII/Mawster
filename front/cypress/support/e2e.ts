/// <reference types="cypress" />

const BACKEND = "http://localhost:8000";

// ── Truncate DB (direct backend call) ────────────────────────────────────────

Cypress.Commands.add("truncateDb", () => {
  cy.request("POST", `${BACKEND}/dev/truncate`).then((res) => {
    expect(res.status).to.eq(200);
  });
});

// ── Register user via Discord mock (direct backend call) ─────────────────────

Cypress.Commands.add("registerUser", (accessToken = "cypress-test-token") => {
  cy.request({
    method: "POST",
    url: `${BACKEND}/auth/discord`,
    body: { access_token: accessToken },
  }).then((res) => {
    expect(res.status).to.eq(200);
    return res.body;
  });
});

// ── Create game account (direct backend call) ───────────────────────────────

Cypress.Commands.add(
  "apiCreateGameAccount",
  (token: string, pseudo: string, isPrimary = false) => {
    cy.request({
      method: "POST",
      url: `${BACKEND}/game-accounts`,
      headers: { Authorization: `Bearer ${token}` },
      body: { game_pseudo: pseudo, is_primary: isPrimary },
    }).then((res) => {
      expect(res.status).to.eq(201);
      return res.body;
    });
  }
);

// ── Load champion (direct backend admin call) ───────────────────────────────

Cypress.Commands.add(
  "apiLoadChampion",
  (
    adminToken: string,
    name: string,
    championClass: string,
    options: { is_ascendable?: boolean } = {}
  ) => {
    cy.request({
      method: "POST",
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
      return res.body;
    });
  }
);

// ── Create alliance (direct backend call) ────────────────────────────────────

Cypress.Commands.add(
  "apiCreateAlliance",
  (token: string, name: string, tag: string, ownerGameAccountId: string) => {
    cy.request({
      method: "POST",
      url: `${BACKEND}/alliances`,
      headers: { Authorization: `Bearer ${token}` },
      body: { name, tag, owner_game_account_id: ownerGameAccountId },
    }).then((res) => {
      expect(res.status).to.eq(201);
      return res.body;
    });
  }
);

// ── UI login via dev-login flow ──────────────────────────────────────────────

Cypress.Commands.add("uiLogin", (userName: string) => {
  cy.visit("/login");
  cy.contains("button", userName).click();
  cy.url().should("not.include", "/login");
});

// ── Helper: register + promote via API, returns user data ────────────────────

function getProfile(
  accessToken: string
): Cypress.Chainable<{ id: string; login: string }> {
  return cy
    .request({
      method: "GET",
      url: `${BACKEND}/auth/session`,
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .then((res) => ({ id: res.body.id, login: res.body.login }));
}

function promoteAndRelogin(
  userId: string,
  login: string
): Cypress.Chainable<{ access_token: string; refresh_token: string; user_id: string; login: string }> {
  return cy
    .request({
      method: "POST",
      url: `${BACKEND}/dev/promote`,
      body: { user_id: userId, role: "admin" },
    })
    .then(() => {
      return cy
        .request({
          method: "POST",
          url: `${BACKEND}/dev/login`,
          body: { user_id: userId },
        })
        .then((loginRes) => ({
          access_token: loginRes.body.access_token,
          refresh_token: loginRes.body.refresh_token,
          user_id: userId,
          login,
        }));
    });
}

export function setupAdmin(
  discordToken = "cypress-admin-token"
): Cypress.Chainable<{ access_token: string; refresh_token: string; user_id: string; login: string }> {
  return cy.registerUser(discordToken).then((tokens) => {
    return getProfile(tokens.access_token).then((profile) => {
      return promoteAndRelogin(profile.id, profile.login);
    });
  });
}

// ── Helper: register a regular user via API, returns user data ───────────────

export function setupUser(
  discordToken = "cypress-test-token"
): Cypress.Chainable<{ access_token: string; refresh_token: string; user_id: string; login: string }> {
  return cy.registerUser(discordToken).then((tokens) => {
    return getProfile(tokens.access_token).then((profile) => ({
      ...tokens,
      user_id: profile.id,
      login: profile.login,
    }));
  });
}
