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
        url: `${BACKEND}/admin/seasons/${res.body.id}/activate`,
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
    );
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
