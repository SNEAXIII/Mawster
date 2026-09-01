import { setupAttackerScenario } from '../../support/e2e';

describe('War – attacker panel player filter', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // Owner attacks node 1, member attacks node 2, so the player filter has one
  // group per member to hide. Iron Man is already placed as defender on node 10
  // by setupAttackerScenario — hence two distinct champions here.
  function setupTwoAttackers(prefix: string) {
    return setupAttackerScenario(prefix).then((scenario) => {
      const { adminToken, ownerData, memberData, allianceId, ownerAccId, warId, championUserId } = scenario;
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

      cy.apiLogin(ownerData.user_id, 'war');
      // Same truncation setupAttackerScenario applies to the generated pseudos.
      return cy.wrap(
        { ownerGroup: `${prefix}Owner`.slice(0, 16), memberGroup: `${prefix}Member`.slice(0, 16) },
        { log: false },
      );
    });
  }

  it('player filter hides other member groups and dims their nodes on the map', () => {
    setupTwoAttackers('war-pflt').then(({ ownerGroup, memberGroup }) => {
      cy.getByCy(`attacker-member-${ownerGroup}`).should('be.visible');
      cy.getByCy(`attacker-member-${memberGroup}`).should('be.visible');

      cy.selectOption('war-player-filter', ownerGroup);

      cy.getByCy(`attacker-member-${ownerGroup}`).should('be.visible');
      cy.getByCy(`attacker-member-${memberGroup}`).should('not.exist');

      cy.getByCy('war-node-1').should('not.have.class', 'opacity-25');
      cy.getByCy('war-node-2').should('have.class', 'opacity-25');
    });
  });

  it('player filter restores all member groups when reset to All', () => {
    setupTwoAttackers('war-pflt-r').then(({ ownerGroup, memberGroup }) => {
      cy.selectOption('war-player-filter', ownerGroup);
      cy.getByCy(`attacker-member-${memberGroup}`).should('not.exist');

      cy.selectOption('war-player-filter', 'All');

      cy.getByCy(`attacker-member-${ownerGroup}`).scrollIntoView().should('be.visible');
      cy.getByCy(`attacker-member-${memberGroup}`).scrollIntoView().should('be.visible');
    });
  });
});
