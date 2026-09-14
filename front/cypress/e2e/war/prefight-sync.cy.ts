import { confirmAction, setupPrefightScenario } from '../../support/e2e';

// The war map must follow what the API removed, without waiting for the next poll.
describe('War – prefight stays in sync with the server', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('removing a prefight on one node keeps the same champion on the other node', () => {
    setupPrefightScenario('pfs-node').then(
      ({
        adminToken,
        ownerData,
        memberData,
        memberAccId,
        allianceId,
        warId,
        championUserId,
        prefightChampionUserId,
      }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiLoadChampion(adminToken, 'Captain Marvel', 'Cosmic').then((champs: { id: string }[]) => {
          cy.apiPlaceWarDefender(ownerData.access_token, allianceId, warId, 1, 11, champs[0].id, 7, 3, 0);
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3').then(
            (cu: { id: string }) => {
              cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 11, cu.id);
            },
          );
        });
        cy.apiAddWarPrefight(memberData.access_token, allianceId, warId, 1, prefightChampionUserId, 10);
        cy.apiAddWarPrefight(memberData.access_token, allianceId, warId, 1, prefightChampionUserId, 11);

        cy.openWarAttackerPanel(memberData.user_id);
        cy.getByCy('prefight-entry-node-10').should('be.visible');
        cy.getByCy('prefight-entry-node-11').should('be.visible');

        cy.getByCy('remove-prefight-node-11').click();
        cy.get('[data-cy="prefight-entry-node-11"]').should('not.exist');
        cy.get('[data-cy="prefight-entry-node-10"]').should('be.visible');

        // What the server kept, not only what the screen shows.
        cy.reload();
        cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
        cy.get('[data-cy="prefight-entry-node-10"]').should('be.visible');
        cy.get('[data-cy="prefight-entry-node-11"]').should('not.exist');
      },
    );
  });

  it('removing the defender clears its prefight from the panel without a reload', () => {
    setupPrefightScenario('pfs-def').then(
      ({ ownerData, memberData, allianceId, warId, championUserId, prefightChampionUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiAddWarPrefight(memberData.access_token, allianceId, warId, 1, prefightChampionUserId, 10);

        cy.goToWarMode(ownerData.user_id, 'defenders');
        cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
        cy.get('[data-cy="prefight-entry-node-10"]').should('be.visible');

        cy.getByCy('war-node-10').scrollIntoView().find('button').focus().click();
        cy.getByCy('confirmation-dialog-confirm').click();

        cy.getByCy('war-node-10').should('contain', '+');
        cy.get('[data-cy="prefight-entry-node-10"]').should('not.exist');
      },
    );
  });

  it('removing the attacker clears the prefight aimed at its node without a reload', () => {
    setupPrefightScenario('pfs-atk').then(
      ({ ownerData, memberData, allianceId, warId, championUserId, prefightChampionUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiAddWarPrefight(memberData.access_token, allianceId, warId, 1, prefightChampionUserId, 10);

        cy.goToWarMode(ownerData.user_id, 'attackers');
        cy.getByCy('attacker-entry-node-10').scrollIntoView().should('be.visible');
        cy.get('[data-cy="prefight-entry-node-10"]').should('be.visible');

        confirmAction('remove-attacker-node-10');

        cy.get('[data-cy="attacker-entry-node-10"]').should('not.exist');
        cy.get('[data-cy="prefight-entry-node-10"]').should('not.exist');
      },
    );
  });
});
