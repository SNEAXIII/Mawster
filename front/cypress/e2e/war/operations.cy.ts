import { setupWarOwner, setupAttackerScenario } from '../../support/e2e';

describe('War – Operations (declare, place, remove)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Declare war via UI ────────────────────────────────────────────────────

  it('officer can declare a war via the dialog', () => {
    setupWarOwner('war-op-declare', 'DeclareOp', 'DeclareOpAlliance', 'DO').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
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
        cy.apiLogin(ownerData.user_id);
        cy.navTo('war');
        cy.getByCy('war-mode-defenders').click();
        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('war-champion-search').type('Iron Man');
        cy.getByCy('war-champion-card-Iron-Man').click();
        cy.getByCy('war-confirm-place').click();

        cy.contains('placed on node #1').should('be.visible');
        cy.getByCy('war-node-1').should('not.contain', '+');
      });
    });
  });

  // ── Remove defender via war map X ─────────────────────────────────────────

  it('officer can remove a defender from the war map', () => {
    setupWarOwner('war-op-remove', 'RemoveOp', 'RemoveOpAlliance', 'RO').then(
      ({ adminData, ownerData, allianceId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Science').then((champs) => {
          cy.apiCreateWar(ownerData.access_token, allianceId, 'RemoveEnemy').then((war) => {
            cy.apiPlaceWarDefender(ownerData.access_token, allianceId, war.id, 1, 5, champs[0].id, 7, 3);

            cy.apiLogin(ownerData.user_id);
            cy.navTo('war');
            cy.getByCy('war-mode-defenders').click();

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

          cy.apiLogin(ownerData.user_id);
          cy.navTo('war');

          cy.getByCy('clear-war-bg-btn').should('be.visible').click();
          cy.getByCy('confirmation-dialog-confirm').click();
          cy.contains('Battlegroup cleared').should('be.visible');
          cy.getByCy('war-node-10').should('contain', '+');
        });
      });
    });
  });

  // ── Defender selector: shows current placement entry row ─────────────────

  it('opening selector on occupied node shows the current placement entry row', () => {
    setupAttackerScenario('war-op-def-entry').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('war-mode-defenders').click();

      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('attacker-entry-node-10').should('be.visible');
    });
  });

  it('opening selector on empty node does not show an entry row', () => {
    setupAttackerScenario('war-op-def-entry-empty').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('war-mode-defenders').click();

      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
      cy.getByCy('attacker-entry-node-1').should('not.exist');
    });
  });

  // ── Defender selector dialog: close without crash ────────────────────────

  it('closing the defender selector dialog does not crash the page', () => {
    setupWarOwner('war-op-def-esc', 'DefEscOp', 'DefEscAlliance', 'DE').then(({ ownerData, allianceId }) => {
      cy.apiCreateWar(ownerData.access_token, allianceId, 'DefEscEnemy').then(() => {
        cy.apiLogin(ownerData.user_id);
        cy.navTo('war');
        cy.getByCy('war-mode-defenders').click();

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('war-champion-search').should('be.visible');

        // Close via Escape — regression: hand-rolled overlay didn't support Escape
        cy.get('body').type('{esc}');
        cy.getByCy('war-champion-search').should('not.exist');

        // Page should still be functional — reopen the selector
        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('war-champion-search').should('be.visible');
      });
    });
  });

  // ── Switch battlegroup ────────────────────────────────────────────────────

  it('any member can switch between battlegroups with G1/G2/G3 buttons', () => {
    setupAttackerScenario('war-op-bg-switch').then(({ adminToken, ownerData, memberData, allianceId, warId }) => {
      cy.apiLoadChampion(adminToken, 'Gamora', 'Cosmic').then((champs) => {
        // Place Gamora in BG2 node 1
        cy.apiPlaceWarDefender(ownerData.access_token, allianceId, warId, 2, 1, champs[0].id, 7, 3, 0);

        // Log in as a regular member (not an officer)
        cy.apiLogin(memberData.user_id);
        cy.navTo('war');

        // BG1 node 1 should be empty (Iron Man is at node 10)
        cy.getByCy('war-node-1').should('contain', '+');

        // Switch to G2 — available to all members, not just officers
        cy.getByCy('bg-btn-2').click();
        cy.getByCy('war-node-1').should('not.contain', '+');
      });
    });
  });
});
