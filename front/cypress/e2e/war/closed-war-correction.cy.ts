import type { BatchSetupUserResult } from '../../support/index';
import { openWarNode } from '../../support/e2e';

interface ClosedWarScenario {
  adminAT: string;
  ownerData: BatchSetupUserResult;
  memberData: BatchSetupUserResult;
  allianceId: string;
  ownerAccId: string;
  memberAccId: string;
  warId: string;
  seasonId: string;
  championId: string;
  championUserId: string;
}

/**
 * Admin + owner (alliance, BG1) + member (BG1), an open season, one champion on the
 * member's roster, a War with a defender on node 1 and the member's attacker on it,
 * then the War is ended — the shared starting point for every correction scenario.
 */
function setupClosedWar(prefix: string): Cypress.Chainable<ClosedWarScenario> {
  const adminToken = `${prefix}-admin`;
  const ownerToken = `${prefix}-owner`;
  const memberToken = `${prefix}-member`;

  return cy
    .apiBatchSetup([
      { discord_token: adminToken, role: 'admin' },
      {
        discord_token: ownerToken,
        game_pseudo: `${prefix}Own`.slice(0, 16),
        create_alliance: { name: `${prefix}All`.slice(0, 20), tag: prefix.slice(0, 3).toUpperCase() },
        battlegroup: 1,
      },
      {
        discord_token: memberToken,
        game_pseudo: `${prefix}Mem`.slice(0, 16),
        join_alliance_token: ownerToken,
        battlegroup: 1,
      },
    ])
    .then((users) => {
      const adminAT = users[adminToken].access_token;
      const ownerData = users[ownerToken];
      const memberData = users[memberToken];
      const allianceId = users[ownerToken].alliance_id!;
      const memberAccId = users[memberToken].account_id!;

      return cy.apiCreateOpenSeason(adminAT, 1).then((seasonId) =>
        cy.apiLoadChampion(adminAT, 'Iron Man', 'Tech').then((champs) => {
          const championId = champs[0].id as string;
          return cy.apiAddChampionToRoster(memberData.access_token, memberAccId, championId, '7r3').then((cu) => {
            const championUserId = cu.id as string;
            return cy.apiCreateWar(ownerData.access_token, allianceId, `${prefix}Enemy`).then((war) => {
              cy.apiPlaceWarDefender(ownerData.access_token, allianceId, war.id, 1, 1, championId, 7, 3, 0);
              cy.apiAssignWarAttacker(memberData.access_token, allianceId, war.id, 1, 1, championUserId);
              return cy.apiEndWar(ownerData.access_token, allianceId, war.id, true, 10).then(() => ({
                adminAT,
                ownerData,
                memberData,
                allianceId,
                ownerAccId: users[ownerToken].account_id!,
                memberAccId,
                warId: war.id as string,
                seasonId: seasonId as string,
                championId,
                championUserId,
              }));
            });
          });
        }),
      );
    });
}

/** Open the war dropdown and pick the war with this id. */
function selectWar(warId: string): void {
  cy.getByCy('war-select').click();
  cy.get('[role="listbox"]').should('be.visible');
  cy.getByCy(`war-select-${warId}`).click();
}

describe('War – closed war correction', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('officer sees and corrects a closed war', () => {
    setupClosedWar('cwc1').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'war');

      cy.getByCy('war-select').should('be.visible').and('contain', 'cwc1Enemy');
      cy.getByCy('war-status-ended').should('be.visible');
      cy.getByCy('end-war-btn').should('not.exist');

      cy.intercept('PATCH', '**/node/1/ko').as('updateKo');
      cy.getByCy('attacker-entry-node-1').scrollIntoView().should('be.visible');
      cy.getByCy('ko-value-node-1').should('have.text', '0');
      cy.getByCy('ko-inc-node-1').click();
      cy.getByCy('ko-value-node-1').should('have.text', '1');
      // The KO is flushed after a delay: reloading before the PATCH would lose it.
      cy.wait('@updateKo').its('response.statusCode').should('eq', 200);

      cy.reload();
      cy.getByCy('war-select').should('contain', 'cwc1Enemy');
      cy.getByCy('attacker-entry-node-1').scrollIntoView().should('be.visible');
      cy.getByCy('ko-value-node-1').should('have.text', '1');
    });
  });

  it('a closed war has no combat filter and dims no completed fight', () => {
    setupClosedWar('cwcfil').then(({ ownerData, allianceId, warId }) => {
      cy.apiToggleCombatCompleted(ownerData.access_token, allianceId, warId, 1, 1);
      cy.goToWarMode(ownerData.user_id, 'attackers');

      cy.getByCy('war-status-ended').should('be.visible');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('war-combat-filter').should('not.exist');
      cy.getByCy('war-node-1').should('not.have.class', 'opacity-25');
    });
  });

  it('the running war is the default, not the closed one', () => {
    setupClosedWar('cwc2').then(({ ownerData, allianceId, warId }) => {
      cy.apiCreateWar(ownerData.access_token, allianceId, 'cwc2Running').then(() => {
        cy.apiLogin(ownerData.user_id, 'war');

        cy.getByCy('war-select').should('be.visible').and('contain', 'cwc2Running');
        cy.getByCy('war-status-active').should('be.visible');

        selectWar(warId);

        cy.getByCy('war-select').should('contain', 'cwc2Enemy');
        cy.getByCy('war-status-ended').should('be.visible');
      });
    });
  });

  it('a plain member is read-only on a closed war', () => {
    setupClosedWar('cwc3').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id, 'war');

      cy.getByCy('war-status-ended').should('be.visible');
      // The read-only KO label proves the row rendered before checking the controls are absent.
      cy.getByCy('attacker-entry-node-1').scrollIntoView().should('contain', '0 KO');
      cy.getByCy('ko-inc-node-1').should('not.exist');
      cy.getByCy('ko-dec-node-1').should('not.exist');
      cy.getByCy('remove-attacker-node-1').should('not.exist');

      // Clicking the node still opens its detail, without the attacker picker.
      openWarNode(1);
      cy.getByCy('war-attacker-search').within(() => {
        cy.getByCy('attacker-entry-node-1').should('be.visible');
        cy.getByCy('war-attacker-search-champion').should('not.exist');
      });
    });
  });

  it('a strategist corrects a closed war', () => {
    setupClosedWar('cwc4').then(({ ownerData, memberData, allianceId, memberAccId }) => {
      cy.apiAddStrategist(ownerData.access_token, allianceId, memberAccId).then(() => {
        cy.intercept('PATCH', '**/node/1/ko').as('updateKo');
        cy.apiLogin(memberData.user_id, 'war');

        cy.getByCy('war-status-ended').should('be.visible');
        cy.getByCy('attacker-entry-node-1').scrollIntoView().should('be.visible');
        cy.getByCy('ko-value-node-1').should('have.text', '0');
        cy.getByCy('ko-inc-node-1').click();
        cy.getByCy('ko-value-node-1').should('have.text', '1');
        cy.wait('@updateKo').its('response.statusCode').should('eq', 200);
      });
    });
  });

  it("a departed player's fight is locked but its KO stays editable", () => {
    setupClosedWar('cwc5').then(({ ownerData, allianceId, memberAccId }) => {
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 2).then(() => {
        cy.apiLogin(ownerData.user_id, 'war');

        cy.getByCy('node-attacker-locked-1').should('be.visible');
        cy.getByCy('attacker-entry-node-1').scrollIntoView().should('be.visible');
        cy.getByCy('ko-inc-node-1').should('exist');
        cy.getByCy('remove-attacker-node-1').should('not.exist');
      });
    });
  });

  it('a closed war outside the latest season is not listed', () => {
    setupClosedWar('cwc6').then(({ adminAT, ownerData, allianceId, seasonId, warId }) => {
      cy.apiCloseSeason(adminAT, seasonId).then(() => {
        cy.apiCreateOpenSeason(adminAT, 2).then(() => {
          // A running war keeps the dropdown on screen, so the missing entry is a real absence.
          cy.apiCreateWar(ownerData.access_token, allianceId, 'cwc6Running').then((running) => {
            cy.apiLogin(ownerData.user_id, 'war');

            cy.getByCy('war-select').should('be.visible').and('contain', 'cwc6Running').click();
            cy.get('[role="listbox"]').should('be.visible');
            cy.getByCy(`war-select-${running.id}`).should('exist');
            cy.getByCy(`war-select-${warId}`).should('not.exist');
          });
        });
      });
    });
  });

  it('the statistics war dropdown still defaults to all wars', () => {
    setupClosedWar('cwc7').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.goToAllianceStatsTab();

      cy.getByCy('statistics-war-filter').click();
      cy.get('[role="listbox"]').should('be.visible');
      cy.getByCy('statistics-war-all').should('have.attr', 'data-state', 'checked');
    });
  });
});
