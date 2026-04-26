import { setupPrefightScenario } from '../../support/e2e';

describe('War – prefight highlight on map', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('node with prefight gets cyan ring on the map', () => {
    setupPrefightScenario('pf-ring').then(
      ({ memberData, allianceId, warId, championUserId, prefightChampionUserId }) => {
        // backend requires an attacker assigned before prefight can be added
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiAddWarPrefight(memberData.access_token, allianceId, warId, 1, prefightChampionUserId, 10);

        cy.apiLogin(memberData.user_id);
        cy.navTo('war');

        cy.getByCy('war-node-10').should('have.class', 'ring-foreground');
      },
    );
  });

  it('node without prefight has no cyan ring', () => {
    setupPrefightScenario('pf-no-ring').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id);
      cy.navTo('war');

      cy.getByCy('war-node-10').should('not.have.class', 'ring-cyan-400');
    });
  });

  it('player filter keeps node visible when selected player has prefight (but not the attacker)', () => {
    setupPrefightScenario('pflt').then(
      ({ adminToken, ownerData, memberData, allianceId, ownerAccId, memberAccId, warId, championUserId, prefightChampionUserId }) => {
        cy.apiLoadChampion(adminToken, 'Spider-Man', 'Cosmic').then((champs) => {
          const spiderId = champs[0].id;
          // node 1: member's Wolverine as attacker (so member appears in filter dropdown)
          cy.apiPlaceWarDefender(ownerData.access_token, allianceId, warId, 1, 1, spiderId, 7, 3, 0);
          cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 1, championUserId);

          // node 10: owner's Spider-Man as attacker, member's Storm as prefight
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, spiderId, '7r3').then((ownerCu) => {
            cy.apiAssignWarAttacker(ownerData.access_token, allianceId, warId, 1, 10, ownerCu.id);
            cy.apiAddWarPrefight(memberData.access_token, allianceId, warId, 1, prefightChampionUserId, 10);
          });
        });

        cy.apiLogin(memberData.user_id);
        cy.navTo('war');

        // filter by member: node 10 (owner attacker + member prefight) must NOT be dimmed
        cy.getByCy('war-player-filter').click();
        cy.contains('[role="option"]', 'pfltMember').click();

        cy.getByCy('war-node-1').should('not.have.class', 'opacity-25');
        cy.getByCy('war-node-10').should('not.have.class', 'opacity-25');
      },
    );
  });

  it('player filter dims node where selected player has no attacker and no prefight', () => {
    setupPrefightScenario('pflt2').then(
      ({ adminToken, ownerData, memberData, allianceId, ownerAccId, warId, championUserId, prefightChampionUserId }) => {
        // member: attacker + prefight on node 10
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiAddWarPrefight(memberData.access_token, allianceId, warId, 1, prefightChampionUserId, 10);

        // owner: attacker on node 1 (separate node so owner appears in filter)
        cy.apiLoadChampion(adminToken, 'Spider-Man', 'Cosmic').then((champs) => {
          cy.apiPlaceWarDefender(ownerData.access_token, allianceId, warId, 1, 1, champs[0].id, 7, 3, 0);
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3').then((ownerCu) => {
            cy.apiAssignWarAttacker(ownerData.access_token, allianceId, warId, 1, 1, ownerCu.id);
          });
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('war');

        // filter by owner: node 1 (owner attacker) not dimmed, node 10 (member only) dimmed
        cy.getByCy('war-player-filter').click();
        cy.contains('[role="option"]', 'pflt2Owner').click();

        cy.getByCy('war-node-1').should('not.have.class', 'opacity-25');
        cy.getByCy('war-node-10').should('have.class', 'opacity-25');
      },
    );
  });
});
