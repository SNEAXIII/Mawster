import { BACKEND } from '../../support/e2e';

export function createAndActivateSeason(adminToken: string) {
  return cy
    .request({
      method: 'POST',
      url: `${BACKEND}/admin/seasons`,
      body: { number: 64 },
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    .then((res) =>
      cy.request({
        method: 'PATCH',
        url: `${BACKEND}/admin/seasons/${res.body.id}/open`,
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
    );
}

// Create + open a season and yield its id (needed to close it later).
export function createOpenSeason(adminToken: string, number = 64): Cypress.Chainable<string> {
  return cy
    .request({
      method: 'POST',
      url: `${BACKEND}/admin/seasons`,
      body: { number },
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    .then((res) => {
      const seasonId = (res.body as { id: string }).id;
      return cy
        .request({
          method: 'PATCH',
          url: `${BACKEND}/admin/seasons/${seasonId}/open`,
          headers: { Authorization: `Bearer ${adminToken}` },
        })
        .then(() => seasonId);
    });
}

// Close a season (active -> ended), leaving no active season (pre-season state).
export function closeSeason(adminToken: string, seasonId: string) {
  return cy.request({
    method: 'PATCH',
    url: `${BACKEND}/admin/seasons/${seasonId}/close`,
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

export function setupEndedAssistWar(opts: {
  adminToken: string;
  ownerToken: string;
  ownerAccId: string;
  memberToken: string;
  memberAccId: string;
  allianceId: string;
}) {
  const { adminToken, ownerToken, ownerAccId, memberToken, memberAccId, allianceId } = opts;
  createAndActivateSeason(adminToken);
  return cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((ironManChamps: { id: string }[]) => {
    return cy.apiLoadChampion(adminToken, 'Wolverine', 'Mutant').then((wolvChamps: { id: string }[]) => {
      return cy
        .apiAddChampionToRoster(ownerToken, ownerAccId, ironManChamps[0].id, '7r3')
        .then((cuOwner: { id: string }) => {
          return cy
            .apiAddChampionToRoster(memberToken, memberAccId, wolvChamps[0].id, '7r3')
            .then((cuMember: { id: string }) => {
              return cy.apiCreateWar(ownerToken, allianceId, 'AstEnemy').then((war: { id: string }) => {
                cy.apiPlaceWarDefender(ownerToken, allianceId, war.id, 1, 10, ironManChamps[0].id, 7, 3, 0);
                cy.apiAssignWarAttacker(ownerToken, allianceId, war.id, 1, 10, cuOwner.id);
                cy.request({
                  method: 'POST',
                  url: `${BACKEND}/alliances/${allianceId}/wars/${war.id}/bg/1/node/10/assist`,
                  headers: { Authorization: `Bearer ${memberToken}` },
                  body: { champion_user_id: cuMember.id },
                });
                cy.apiEndWar(ownerToken, allianceId, war.id, true, 10);
              });
            });
        });
    });
  });
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

export function withWarScenario(
  adminToken: string,
  ownerToken: string,
  allianceId: string,
  ownerAccId: string,
  warName: string,
  cb: (args: { champId: string; cuId: string; warId: string }) => void,
) {
  createAndActivateSeason(adminToken).then(() => {
    cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs: { id: string }[]) => {
      cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs[0].id, '7r3').then((cu: { id: string }) => {
        cy.apiCreateWar(ownerToken, allianceId, warName).then((war: { id: string }) => {
          cb({ champId: champs[0].id, cuId: cu.id, warId: war.id });
        });
      });
    });
  });
}

function loadChampAndAddToTwoRosters(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  memberToken: string,
  memberAccId: string,
  cb: (args: { champId: string; cuOwnerId: string; cuMemberId: string }) => void,
) {
  cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs: { id: string }[]) => {
    cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs[0].id, '7r3').then((cuOwner: { id: string }) => {
      cy.apiAddChampionToRoster(memberToken, memberAccId, champs[0].id, '7r3').then((cuMember: { id: string }) => {
        cb({ champId: champs[0].id, cuOwnerId: cuOwner.id, cuMemberId: cuMember.id });
      });
    });
  });
}

export function withWarScenarioTwoPlayers(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  memberToken: string,
  memberAccId: string,
  allianceId: string,
  warName: string,
  cb: (args: { champId: string; cuOwnerId: string; cuMemberId: string; warId: string }) => void,
) {
  createAndActivateSeason(adminToken).then(() => {
    loadChampAndAddToTwoRosters(
      adminToken,
      ownerToken,
      ownerAccId,
      memberToken,
      memberAccId,
      ({ champId, cuOwnerId, cuMemberId }) => {
        cy.apiCreateWar(ownerToken, allianceId, warName).then((war: { id: string }) => {
          cb({ champId, cuOwnerId, cuMemberId, warId: war.id });
        });
      },
    );
  });
}

// Two ended wars in the same season, each fought by a different player:
// the owner fights in war one only, the member in war two only. Lets a spec
// assert that the war filter actually re-scopes the stats table, not just the chart.
export function withTwoEndedWarsTwoPlayers(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  memberToken: string,
  memberAccId: string,
  allianceId: string,
  cb: (args: { warOneId: string; warTwoId: string }) => void,
) {
  createAndActivateSeason(adminToken).then(() => {
    loadChampAndAddToTwoRosters(
      adminToken,
      ownerToken,
      ownerAccId,
      memberToken,
      memberAccId,
      ({ champId, cuOwnerId, cuMemberId }) => {
        cy.apiCreateWar(ownerToken, allianceId, 'WarOne').then((warOne: { id: string }) => {
          addStatsForPlayer(ownerToken, allianceId, warOne.id, champId, cuOwnerId, 10, 0);
          cy.apiEndWar(ownerToken, allianceId, warOne.id, true, 10);
          cy.apiCreateWar(ownerToken, allianceId, 'WarTwo').then((warTwo: { id: string }) => {
            addStatsForPlayer(ownerToken, allianceId, warTwo.id, champId, cuMemberId, 11, 2);
            cy.apiEndWar(ownerToken, allianceId, warTwo.id, true, 10);
            cb({ warOneId: warOne.id, warTwoId: warTwo.id });
          });
        });
      },
    );
  });
}

// Two seasons, one ended war each, fought by a different player. Season 63 is
// closed before 64 opens because a war is stamped with whichever season is
// active when it is created, and only one season may be current at a time.
export function withTwoSeasonsOneWarEach(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  memberToken: string,
  memberAccId: string,
  allianceId: string,
  cb: (args: { pastSeasonId: string; currentSeasonId: string }) => void,
) {
  createOpenSeason(adminToken, 63).then((pastSeasonId) => {
    loadChampAndAddToTwoRosters(
      adminToken,
      ownerToken,
      ownerAccId,
      memberToken,
      memberAccId,
      ({ champId, cuOwnerId, cuMemberId }) => {
        cy.apiCreateWar(ownerToken, allianceId, 'OldWar').then((oldWar: { id: string }) => {
          addStatsForPlayer(ownerToken, allianceId, oldWar.id, champId, cuOwnerId, 10, 3);
          cy.apiEndWar(ownerToken, allianceId, oldWar.id, true, 10);
          closeSeason(adminToken, pastSeasonId);
          createOpenSeason(adminToken, 64).then((currentSeasonId) => {
            cy.apiCreateWar(ownerToken, allianceId, 'NewWar').then((newWar: { id: string }) => {
              addStatsForPlayer(ownerToken, allianceId, newWar.id, champId, cuMemberId, 11, 0);
              cy.apiEndWar(ownerToken, allianceId, newWar.id, true, 10);
              cb({ pastSeasonId, currentSeasonId });
            });
          });
        });
      },
    );
  });
}

function loadTwoChampsAddToRosters(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  memberToken: string,
  memberAccId: string,
  cb: (args: { champ1Id: string; champ2Id: string; cuOwnerId: string; cuMemberId: string }) => void,
) {
  cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs1: { id: string }[]) => {
    cy.apiLoadChampion(adminToken, 'Wolverine', 'Mutant').then((champs2: { id: string }[]) => {
      cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs1[0].id, '7r3').then((cuOwner: { id: string }) => {
        cy.apiAddChampionToRoster(memberToken, memberAccId, champs2[0].id, '7r3').then((cuMember: { id: string }) => {
          cb({ champ1Id: champs1[0].id, champ2Id: champs2[0].id, cuOwnerId: cuOwner.id, cuMemberId: cuMember.id });
        });
      });
    });
  });
}

export function withWarScenarioDiffChampsPlayers(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  memberToken: string,
  memberAccId: string,
  allianceId: string,
  warName: string,
  cb: (args: { champ1Id: string; champ2Id: string; cuOwnerId: string; cuMemberId: string; warId: string }) => void,
) {
  createAndActivateSeason(adminToken).then(() => {
    loadTwoChampsAddToRosters(
      adminToken,
      ownerToken,
      ownerAccId,
      memberToken,
      memberAccId,
      ({ champ1Id, champ2Id, cuOwnerId, cuMemberId }) => {
        cy.apiCreateWar(ownerToken, allianceId, warName).then((war: { id: string }) => {
          cb({ champ1Id, champ2Id, cuOwnerId, cuMemberId, warId: war.id });
        });
      },
    );
  });
}

function loadTwoChampsAddToOneRoster(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  cb: (args: { champ1Id: string; champ2Id: string; cu1Id: string; cu2Id: string }) => void,
) {
  cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs1: { id: string }[]) => {
    cy.apiLoadChampion(adminToken, 'Wolverine', 'Mutant').then((champs2: { id: string }[]) => {
      cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs1[0].id, '7r3').then((cu1: { id: string }) => {
        cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs2[0].id, '7r3').then((cu2: { id: string }) => {
          cb({ champ1Id: champs1[0].id, champ2Id: champs2[0].id, cu1Id: cu1.id, cu2Id: cu2.id });
        });
      });
    });
  });
}

export function withWarScenarioTwoOwnerChamps(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  allianceId: string,
  warName: string,
  cb: (args: { champ1Id: string; champ2Id: string; cu1Id: string; cu2Id: string; warId: string }) => void,
) {
  createAndActivateSeason(adminToken).then(() => {
    loadTwoChampsAddToOneRoster(adminToken, ownerToken, ownerAccId, ({ champ1Id, champ2Id, cu1Id, cu2Id }) => {
      cy.apiCreateWar(ownerToken, allianceId, warName).then((war: { id: string }) => {
        cb({ champ1Id, champ2Id, cu1Id, cu2Id, warId: war.id });
      });
    });
  });
}

function loadTwoChampsAddOneToRoster(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  cb: (args: { champ1Id: string; champ2Id: string; cuId: string }) => void,
) {
  cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs1: { id: string }[]) => {
    cy.apiLoadChampion(adminToken, 'Wolverine', 'Mutant').then((champs2: { id: string }[]) => {
      cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs1[0].id, '7r3').then((cu: { id: string }) => {
        cb({ champ1Id: champs1[0].id, champ2Id: champs2[0].id, cuId: cu.id });
      });
    });
  });
}

export function withWarScenarioDefender(
  adminToken: string,
  ownerToken: string,
  ownerAccId: string,
  allianceId: string,
  warName: string,
  cb: (args: { champ1Id: string; champ2Id: string; cuId: string; warId: string }) => void,
) {
  createAndActivateSeason(adminToken).then(() => {
    loadTwoChampsAddOneToRoster(adminToken, ownerToken, ownerAccId, ({ champ1Id, champ2Id, cuId }) => {
      cy.apiCreateWar(ownerToken, allianceId, warName).then((war: { id: string }) => {
        cb({ champ1Id, champ2Id, cuId, warId: war.id });
      });
    });
  });
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

export function setupStatsOwnerAndMember(
  prefix: string,
  memberBattlegroup = 1,
): Cypress.Chainable<StatsOwnerMemberSetup> {
  const base = statsBase(prefix);
  const adminTok = `${prefix}-admin`;
  const ownerTok = `${prefix}-owner`;
  const memberTok = `${prefix}-member`;

  return cy
    .apiBatchSetup([
      { discord_token: adminTok, role: 'admin' },
      {
        discord_token: ownerTok,
        game_pseudo: `${base}Owner`,
        create_alliance: allianceSpec(base),
        battlegroup: 1,
      },
      {
        discord_token: memberTok,
        game_pseudo: `${base}Member`,
        join_alliance_token: ownerTok,
        battlegroup: memberBattlegroup,
      },
    ])
    .then((users) => ({
      adminToken: users[adminTok].access_token,
      ownerToken: users[ownerTok].access_token,
      ownerUserId: users[ownerTok].user_id,
      ownerAccId: users[ownerTok].account_id!,
      ownerPseudo: `${base}Owner`,
      allianceId: users[ownerTok].alliance_id!,
      memberToken: users[memberTok].access_token,
      memberUserId: users[memberTok].user_id,
      memberAccId: users[memberTok].account_id!,
      memberPseudo: `${base}Member`,
    }));
}

// Remove a member from the alliance — used to turn them into a "former member".
export function removeAllianceMember(ownerToken: string, allianceId: string, gameAccountId: string) {
  return cy.request({
    method: 'DELETE',
    url: `${BACKEND}/alliances/${allianceId}/members/${gameAccountId}`,
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
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
