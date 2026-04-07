import { setupAttackerScenario } from '../../support/e2e';

describe('War – Operations (attacker-linked confirmations)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Remove defender with attacker assigned → confirmation dialog ──────────

  it('removing a defender with an assigned attacker shows a confirmation dialog', () => {
    setupAttackerScenario('war-op-rm-atk').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('war-mode-defenders').click();

      cy.getByCy('war-node-10').scrollIntoView().should('not.contain', '+');
      cy.getByCy('war-node-10').find('button').click({ force: true });

      cy.getByCy('confirmation-dialog-confirm').should('be.visible');
    });
  });

  it('cancelling the confirmation dialog keeps the defender and attacker', () => {
    setupAttackerScenario('war-op-rm-cancel').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('war-mode-defenders').click();

      cy.getByCy('war-node-10').scrollIntoView().find('button').click({ force: true });
      cy.getByCy('confirmation-dialog-confirm').should('be.visible');

      cy.getByCy('confirmation-dialog-cancel').click({ force: true });

      cy.getByCy('war-node-10').should('not.contain', '+');
    });
  });

  it('remove confirmation shows the current combat entry row (readonly)', () => {
    setupAttackerScenario('war-op-rm-entry').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('war-mode-defenders').click();

      cy.getByCy('war-node-10').scrollIntoView().find('button').click({ force: true });

      cy.getByCy('attacker-entry-node-10').should('be.visible');
      cy.getByCy('ko-counter-node-10').should('not.exist');
      cy.getByCy('remove-attacker-node-10').should('not.exist');
    });
  });

  it('remove confirmation shows KO count as text when KO > 0', () => {
    setupAttackerScenario('war-op-rm-ko').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');

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

      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('war-mode-defenders').click();

      cy.getByCy('war-node-10').scrollIntoView().find('button').click({ force: true });
      cy.getByCy('confirmation-dialog-confirm').click();

      cy.contains('Defender removed').should('be.visible');
      cy.getByCy('war-node-10').should('contain', '+');
    });
  });

  // ── Replace defender when attacker is assigned → confirmation dialog ─────

  it('replacing a defender with an assigned attacker shows a confirmation dialog', () => {
    setupAttackerScenario('war-op-replace-atk').then(
      ({ adminToken, ownerData, memberData, allianceId, warId, ownerAccId, championUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiLoadChampion(adminToken, 'Thor', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('war');
        cy.getByCy('war-mode-defenders').click();

        cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
        cy.getByCy('war-champion-card-Thor').click();
        cy.getByCy('war-confirm-place').click();

        cy.getByCy('confirmation-dialog-confirm').should('be.visible');
      },
    );
  });

  it('replace confirmation dialog shows the new defender and the current combat', () => {
    setupAttackerScenario('war-op-replace-show').then(
      ({ adminToken, ownerData, memberData, allianceId, warId, ownerAccId, championUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiLoadChampion(adminToken, 'Thor', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('war');
        cy.getByCy('war-mode-defenders').click();

        cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
        cy.getByCy('war-champion-card-Thor').click();
        cy.getByCy('war-confirm-place').click();

        cy.contains('Replace Defender').should('be.visible');
        cy.getByCy('attacker-entry-node-10').should('be.visible');
      },
    );
  });

  it('cancelling replace keeps the original defender and attacker', () => {
    setupAttackerScenario('war-op-replace-cancel').then(
      ({ adminToken, ownerData, memberData, allianceId, warId, ownerAccId, championUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiLoadChampion(adminToken, 'Thor', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('war');
        cy.getByCy('war-mode-defenders').click();

        cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
        cy.getByCy('war-champion-card-Thor').click();
        cy.getByCy('war-confirm-place').click();
        cy.getByCy('confirmation-dialog-cancel').click({ force: true });

        cy.getByCy('war-node-10').should('not.contain', '+');
        cy.getByCy('war-node-10').should('not.contain', 'Thor');
      },
    );
  });

  it('confirming replace places the new defender and clears the attacker', () => {
    setupAttackerScenario('war-op-replace-confirm').then(
      ({ adminToken, ownerData, memberData, allianceId, warId, ownerAccId, championUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiLoadChampion(adminToken, 'Thor', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('war');
        cy.getByCy('war-mode-defenders').click();

        cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
        cy.getByCy('war-champion-card-Thor').click();
        cy.getByCy('war-confirm-place').click();
        cy.getByCy('confirmation-dialog-confirm').click();

        cy.contains('placed on node #10').should('be.visible');
        cy.getByCy('war-node-10').should('not.contain', '+');
      },
    );
  });
});
