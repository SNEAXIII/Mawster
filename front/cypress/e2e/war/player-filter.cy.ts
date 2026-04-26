import { setupAttackerScenario } from '../../support/e2e';

describe('War – attacker panel player filter', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('player filter hides other member groups and dims their nodes on the map', () => {
    setupAttackerScenario('war-pflt').then(
      ({ adminToken, ownerData, memberData, allianceId, ownerAccId, warId, championUserId }) => {
        // Iron Man is already placed as defender on node 10 by setupAttackerScenario — use distinct champions
        cy.apiLoadChampions(adminToken, [
          { name: 'Spider-Man', cls: 'Cosmic' },
          { name: 'Storm', cls: 'Mutant' },
        ]).then((champMap) => {
          cy.apiPlaceWarDefender(ownerData.access_token, allianceId, warId, 1, 1, champMap['Spider-Man'].id, 7, 3, 0);
          cy.apiPlaceWarDefender(ownerData.access_token, allianceId, warId, 1, 2, champMap['Storm'].id, 7, 3, 0);
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champMap['Spider-Man'].id, '7r3').then((cu) => {
            cy.apiAssignWarAttacker(ownerData.access_token, allianceId, warId, 1, 1, cu.id);
            cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 2, championUserId);
          });
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('war');

        cy.getByCy('attacker-member-war-pfltOwner').should('be.visible');
        cy.getByCy('attacker-member-war-pfltMember').should('be.visible');

        cy.getByCy('war-player-filter').click();
        cy.contains('[role="option"]', 'war-pfltOwner').click();

        cy.getByCy('attacker-member-war-pfltOwner').should('be.visible');
        cy.getByCy('attacker-member-war-pfltMember').should('not.exist');

        cy.getByCy('war-node-1').should('not.have.class', 'opacity-25');
        cy.getByCy('war-node-2').should('have.class', 'opacity-25');
      },
    );
  });

  it('player filter restores all member groups when reset to All', () => {
    setupAttackerScenario('war-pflt-r').then(
      ({ adminToken, ownerData, memberData, allianceId, ownerAccId, warId, championUserId }) => {
        cy.apiLoadChampions(adminToken, [
          { name: 'Spider-Man', cls: 'Cosmic' },
          { name: 'Storm', cls: 'Mutant' },
        ]).then((champMap) => {
          cy.apiPlaceWarDefender(ownerData.access_token, allianceId, warId, 1, 1, champMap['Spider-Man'].id, 7, 3, 0);
          cy.apiPlaceWarDefender(ownerData.access_token, allianceId, warId, 1, 2, champMap['Storm'].id, 7, 3, 0);
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champMap['Spider-Man'].id, '7r3').then((cu) => {
            cy.apiAssignWarAttacker(ownerData.access_token, allianceId, warId, 1, 1, cu.id);
            cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 2, championUserId);
          });
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('war');

        cy.getByCy('war-player-filter').click();
        cy.contains('[role="option"]', 'war-pflt-rOwner').click();
        cy.getByCy('attacker-member-war-pflt-rMember').should('not.exist');

        cy.getByCy('war-player-filter').click();
        cy.contains('[role="option"]', 'All').click();

        cy.getByCy('attacker-member-war-pflt-rOwner').scrollIntoView().should('be.visible');
        cy.getByCy('attacker-member-war-pflt-rMember').scrollIntoView().should('be.visible');
      },
    );
  });
});
