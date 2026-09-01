import { setupAttackerScenario, confirmAction, openWarNode } from '../../support/e2e';

type ReplaceSetup = {
  adminToken: string;
  ownerData: { access_token: string; user_id: string };
  memberData: { access_token: string };
  allianceId: string;
  warId: string;
  ownerAccId: string;
  championUserId: string;
};

/**
 * Attacker assigned on node 10, Thor on the owner's roster, Thor picked for that
 * same node in defenders mode — one click short of the replace confirmation.
 */
function pickThorOverAssignedNode10(s: ReplaceSetup) {
  cy.apiAssignWarAttacker(s.memberData.access_token, s.allianceId, s.warId, 1, 10, s.championUserId);
  cy.apiGiveChampion(s.adminToken, s.ownerData.access_token, s.ownerAccId, 'Thor', 'Cosmic', '7r3');

  cy.apiLogin(s.ownerData.user_id, 'war');
  cy.getByCy('war-mode-defenders').click();

  openWarNode(10);
  cy.getByCy('war-champion-card-Thor').click();
}

describe('War – Operations (attacker-linked confirmations)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Remove defender with attacker assigned → confirmation dialog ──────────

  it('removing a defender with an assigned attacker shows a confirmation dialog', () => {
    setupAttackerScenario('war-op-rm-atk').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.goToWarMode(ownerData.user_id, 'defenders');

      cy.getByCy('war-node-10').scrollIntoView().should('not.contain', '+');
      cy.getByCy('war-node-10').find('button').click({ force: true });

      cy.getByCy('confirmation-dialog-confirm').should('be.visible');
    });
  });

  it('cancelling the confirmation dialog keeps the defender and attacker', () => {
    setupAttackerScenario('war-op-rm-cancel').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.goToWarMode(ownerData.user_id, 'defenders');

      cy.getByCy('war-node-10').scrollIntoView().find('button').click({ force: true });
      cy.getByCy('confirmation-dialog-confirm').should('be.visible');

      cy.getByCy('confirmation-dialog-cancel').click({ force: true });

      cy.getByCy('war-node-10').should('not.contain', '+');
    });
  });

  it('remove confirmation shows the current combat entry row (readonly)', () => {
    setupAttackerScenario('war-op-rm-entry').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.goToWarMode(ownerData.user_id, 'defenders');

      cy.getByCy('war-node-10').scrollIntoView().find('button').click({ force: true });

      cy.getByCy('attacker-entry-node-10').should('be.visible');
      cy.getByCy('ko-counter-node-10').should('not.exist');
      cy.getByCy('remove-attacker-node-10').should('not.exist');
    });
  });

  it('remove confirmation shows KO count as text when KO > 0', () => {
    setupAttackerScenario('war-op-rm-ko').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.apiLogin(ownerData.user_id, 'war');

      cy.intercept('PATCH', '**/node/10/ko').as('updateKo');
      cy.getByCy('ko-inc-node-10').click();
      cy.wait('@updateKo');
      cy.getByCy('ko-counter-node-10').should('contain', '1');
      cy.getByCy('ko-inc-node-10').click();
      cy.wait('@updateKo');
      cy.getByCy('ko-counter-node-10').should('contain', '2');

      cy.getByCy('war-mode-defenders').click();
      cy.getByCy('war-node-10').scrollIntoView().find('button').click({ force: true });

      cy.getByCy('attacker-entry-node-10').should('contain', '2 KO');
    });
  });

  it('confirming the dialog removes the defender (and its attacker) from the node', () => {
    setupAttackerScenario('war-op-rm-confirm').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.goToWarMode(ownerData.user_id, 'defenders');

      cy.getByCy('war-node-10').scrollIntoView().find('button').click({ force: true });
      cy.getByCy('confirmation-dialog-confirm').click();

      cy.contains('Defender removed').should('be.visible');
      cy.getByCy('war-node-10').should('contain', '+');
    });
  });

  // ── Replace defender when attacker is assigned → confirmation dialog ─────

  it('replacing a defender with an assigned attacker shows a confirmation dialog', () => {
    setupAttackerScenario('war-op-replace-atk').then((s) => {
      pickThorOverAssignedNode10(s);
      cy.getByCy('war-confirm-place').click();

      cy.getByCy('confirmation-dialog-confirm').should('be.visible');
    });
  });

  it('replace confirmation dialog shows the new defender and the current combat', () => {
    setupAttackerScenario('war-op-replace-show').then((s) => {
      pickThorOverAssignedNode10(s);
      cy.getByCy('war-confirm-place').click();

      cy.contains('Replace Defender').should('be.visible');
      cy.getByCy('attacker-entry-node-10').should('be.visible');
    });
  });

  it('cancelling replace keeps the original defender and attacker', () => {
    setupAttackerScenario('war-op-replace-cancel').then((s) => {
      pickThorOverAssignedNode10(s);
      cy.getByCy('war-confirm-place').click();
      cy.getByCy('confirmation-dialog-cancel').click({ force: true });

      cy.getByCy('war-node-10').should('not.contain', '+');
      cy.getByCy('war-node-10').should('not.contain', 'Thor');
    });
  });

  it('confirming replace places the new defender and clears the attacker', () => {
    setupAttackerScenario('war-op-replace-confirm').then((s) => {
      pickThorOverAssignedNode10(s);
      confirmAction('war-confirm-place');

      cy.contains('placed on node #10').should('be.visible');
      cy.getByCy('war-node-10').should('not.contain', '+');
    });
  });
});
