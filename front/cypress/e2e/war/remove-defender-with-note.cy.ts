import { setupAttackerScenario } from '../../support/e2e';

// Bug: removing a defender 500'd when a war fight note referenced the placement
// (non-nullable FK). The FK is now SET NULL, so the note survives and the removal
// also tears down the node's attacker/synergy/prefight plan.
describe('War – Remove defender that has a fight note', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('removes the defender without a foreign-key error when a note exists', () => {
    setupAttackerScenario('rm-note').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      // A note can only be attached to a node that has an assigned attacker.
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiUpsertWarNote(ownerData.access_token, allianceId, warId, 1, 10, 'Bait the special then heavy');

      cy.goToWarMode(ownerData.user_id, 'defenders');

      cy.intercept('DELETE', '**/bg/1/node/10').as('removeDefender');
      cy.getByCy('war-node-10').scrollIntoView().find('button').click({ force: true });
      cy.getByCy('confirmation-dialog-confirm').click();

      // Previously this responded 500 (FK constraint); it must now succeed.
      cy.wait('@removeDefender').its('response.statusCode').should('eq', 204);
      cy.contains('Defender removed').should('be.visible');
      cy.getByCy('war-node-10').should('contain', '+');
    });
  });

  it('keeps the note so it can be reused by the next defender on that node', () => {
    setupAttackerScenario('rm-note-keep').then(
      ({ adminToken, ownerData, memberData, allianceId, warId, championUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiUpsertWarNote(ownerData.access_token, allianceId, warId, 1, 10, 'Keep me across defenders');

        // Remove then re-place a defender + attacker on the same node.
        cy.apiRemoveWarDefender(ownerData.access_token, allianceId, warId, 1, 10);
        cy.apiLoadChampion(adminToken, 'Storm', 'Mutant').then((champs: { id: string }[]) => {
          cy.apiPlaceWarDefender(ownerData.access_token, allianceId, warId, 1, 10, champs[0].id, 7, 3, 0);
        });
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        cy.apiLogin(ownerData.user_id);
        cy.visit('/game/war');
        cy.getByCy('node-actions-trigger-node-10').click();
        cy.getByCy('war-note-input').should('have.value', 'Keep me across defenders');
      },
    );
  });
});
