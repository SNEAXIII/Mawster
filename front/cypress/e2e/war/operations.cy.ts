import { setupWarOwner, setupAttackerScenario } from '../../support/e2e';

describe('War – Operations (declare, place, remove)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Declare war via UI ────────────────────────────────────────────────────

  it('officer can declare a war via the dialog', () => {
    setupWarOwner('war-op-declare', 'DeclareOp', 'DeclareOpAlliance', 'DO').then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo('war');

      cy.getByCy('declare-war-btn').click();
      cy.getByCy('opponent-name-input').type('MightyFoes');
      cy.getByCy('create-war-confirm').click();

      cy.contains('War declared against MightyFoes').should('be.visible');
      cy.getByCy('war-opponent-name').should('contain', 'MightyFoes');
    });
  });

  // ── Place defender via UI ─────────────────────────────────────────────────

  it('officer can place a champion on a war node', () => {
    setupWarOwner('war-op-place', 'PlaceOp', 'PlaceOpAlliance', 'PO').then(({ adminData, ownerData, allianceId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Iron Man', 'Tech');

      cy.apiCreateWar(ownerData.access_token, allianceId, 'PlaceEnemy').then(() => {
        cy.uiLogin(ownerData.login);
        cy.navTo('war');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('war-champion-search').type('Iron Man');
        cy.getByCy('war-champion-card-Iron-Man').click();
        cy.getByCy('war-confirm-place').click();

        cy.contains('placed on node #1').should('be.visible');
        cy.getByCy('war-node-1').should('not.contain', '+');
      });
    });
  });

  // ── Placed champion disappears from selector ──────────────────────────────

  it('placed champion no longer appears in the selector list', () => {
    setupWarOwner('war-op-placed-hidden', 'PlacedHiddenOp', 'PlacedHiddenAlliance', 'PH').then(
      ({ adminData, ownerData, allianceId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Iron Man', 'Tech');
        cy.apiLoadChampion(adminData.access_token, 'Thor', 'Cosmic');

        cy.apiCreateWar(ownerData.access_token, allianceId, 'HiddenEnemy').then(() => {
          cy.uiLogin(ownerData.login);
          cy.navTo('war');

          // Place Iron Man on node 1
          cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
          cy.getByCy('war-champion-search').type('Iron Man');
          cy.getByCy('war-champion-card-Iron-Man').click();
          cy.getByCy('war-confirm-place').click();
          cy.contains('placed on node #1').should('be.visible');

          // Open selector on node 2 — Iron Man should be gone, Thor should remain
          cy.getByCy('war-node-2').scrollIntoView().click({ force: true });
          cy.getByCy('war-champion-search').type('Iron Man');
          cy.getByCy('war-champion-card-Iron-Man').should('not.exist');

          cy.getByCy('war-champion-search').clear().type('Thor');
          cy.getByCy('war-champion-card-Thor').should('be.visible');
        });
      },
    );
  });

  // ── Remove defender via war map X ─────────────────────────────────────────

  it('officer can remove a defender from the war map', () => {
    setupWarOwner('war-op-remove', 'RemoveOp', 'RemoveOpAlliance', 'RO').then(
      ({ adminData, ownerData, allianceId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Science').then((champs) => {
          cy.apiCreateWar(ownerData.access_token, allianceId, 'RemoveEnemy').then((war) => {
            cy.apiPlaceWarDefender(ownerData.access_token, allianceId, war.id, 1, 5, champs[0].id, 7, 3);

            cy.uiLogin(ownerData.login);
            cy.navTo('war');

            cy.getByCy('war-node-5').scrollIntoView().should('not.contain', '+');
            cy.getByCy('war-node-5').find('button').click({ force: true });

            cy.contains('Defender removed').should('be.visible');
            cy.getByCy('war-node-5').should('contain', '+');
          });
        });
      },
    );
  });

  // ── Clear BG ──────────────────────────────────────────────────────────────

  it('officer can clear all defenders in a battlegroup', () => {
    setupWarOwner('war-op-clear', 'ClearOp', 'ClearOpAlliance', 'CO').then(({ adminData, ownerData, allianceId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'ClearEnemy').then((war) => {
          cy.apiPlaceWarDefender(ownerData.access_token, allianceId, war.id, 1, 10, champs[0].id, 7, 3);

          cy.uiLogin(ownerData.login);
          cy.navTo('war');

          cy.getByCy('clear-war-bg-btn').should('be.visible').click();
          cy.getByCy('confirmation-dialog-confirm').click();
          cy.contains('Battlegroup cleared').should('be.visible');
          cy.getByCy('war-node-10').should('contain', '+');
        });
      });
    });
  });

  // ── Remove defender with attacker assigned → confirmation dialog ──────────

  it('removing a defender with an assigned attacker shows a confirmation dialog', () => {
    setupAttackerScenario('war-op-rm-atk').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.uiLogin(ownerData.login);
      cy.navTo('war');

      cy.getByCy('war-node-10').scrollIntoView().should('not.contain', '+');
      cy.getByCy('war-node-10').find('button').click({ force: true });

      cy.getByCy('confirmation-dialog-confirm').should('be.visible');
    });
  });

  it('cancelling the confirmation dialog keeps the defender and attacker', () => {
    setupAttackerScenario('war-op-rm-cancel').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.uiLogin(ownerData.login);
      cy.navTo('war');

      cy.getByCy('war-node-10').scrollIntoView().find('button').click({ force: true });
      cy.getByCy('confirmation-dialog-confirm').should('be.visible');

      // Close dialog without confirming
      cy.getByCy('confirmation-dialog-cancel').click({ force: true });

      cy.getByCy('war-node-10').should('not.contain', '+');
    });
  });

  it('confirming the dialog removes the defender (and its attacker) from the node', () => {
    setupAttackerScenario('war-op-rm-confirm').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.uiLogin(ownerData.login);
      cy.navTo('war');

      cy.getByCy('war-node-10').scrollIntoView().find('button').click({ force: true });
      cy.getByCy('confirmation-dialog-confirm').click();

      cy.contains('Defender removed').should('be.visible');
      cy.getByCy('war-node-10').should('contain', '+');
    });
  });

  // ── Switch battlegroup ────────────────────────────────────────────────────

  it('officer can switch between battlegroups with G1/G2/G3 buttons', () => {
    setupWarOwner('war-op-bg-switch', 'BgSwitchOp', 'BgSwitchAlliance', 'BS').then(
      ({ adminData, ownerData, allianceId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Gamora', 'Cosmic').then((champs) => {
          cy.apiCreateWar(ownerData.access_token, allianceId, 'BgEnemy').then((war) => {
            // Place in BG2
            cy.apiPlaceWarDefender(ownerData.access_token, allianceId, war.id, 2, 1, champs[0].id, 7, 3);

            cy.uiLogin(ownerData.login);
            cy.navTo('war');

            // BG1 node 1 should be empty
            cy.getByCy('war-node-1').should('contain', '+');

            // Switch to G2
            cy.getByCy('bg-btn-2').click();
            cy.getByCy('war-node-1').should('not.contain', '+');
          });
        });
      },
    );
  });
});
