import { confirmAction, setupPrefightScenario } from '../../support/e2e';

// Removing the node's defender or attacker must drop the prefight the API deleted with it.
const NODE_TEARDOWNS = [
  {
    what: 'defender',
    mode: 'defenders',
    remove: () => {
      cy.getByCy('war-node-10').scrollIntoView().find('button').focus().click();
      cy.getByCy('confirmation-dialog-confirm').click();
      cy.getByCy('war-node-10').should('contain', '+');
    },
  },
  {
    what: 'attacker',
    mode: 'attackers',
    remove: () => {
      confirmAction('remove-attacker-node-10');
      cy.get('[data-cy="attacker-entry-node-10"]').should('not.exist');
    },
  },
] as const;

describe('War – prefight stays in sync with the server', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('removing a prefight on one node keeps the same champion on the other node', () => {
    setupPrefightScenario('pfs-node').then((s) => {
      const token = s.memberData.access_token;
      cy.apiAssignWarAttacker(token, s.allianceId, s.warId, 1, 10, s.championUserId);
      cy.apiLoadChampion(s.adminToken, 'Captain Marvel', 'Cosmic').then((champs: { id: string }[]) => {
        cy.apiPlaceWarDefender(s.ownerData.access_token, s.allianceId, s.warId, 1, 11, champs[0].id, 7, 3, 0);
        cy.apiAddChampionToRoster(token, s.memberAccId, champs[0].id, '7r3').then((cu: { id: string }) => {
          cy.apiAssignWarAttacker(token, s.allianceId, s.warId, 1, 11, cu.id);
        });
      });
      [10, 11].forEach((node) => cy.apiAddWarPrefight(token, s.allianceId, s.warId, 1, s.prefightChampionUserId, node));

      cy.openWarAttackerPanel(s.memberData.user_id);
      cy.getByCy('prefight-entry-node-11').should('be.visible');
      cy.getByCy('remove-prefight-node-11').click();

      // Checked on screen first, then after a reload so it reflects what the server kept.
      [false, true].forEach((reload) => {
        if (reload) cy.reload();
        cy.get('[data-cy="prefight-entry-node-10"]').should('be.visible');
        cy.get('[data-cy="prefight-entry-node-11"]').should('not.exist');
      });
    });
  });

  NODE_TEARDOWNS.forEach(({ what, mode, remove }) => {
    it(`removing the ${what} clears the prefight aimed at its node without a reload`, () => {
      setupPrefightScenario(`pfs-${what}`).then((s) => {
        cy.apiAssignWarAttacker(s.memberData.access_token, s.allianceId, s.warId, 1, 10, s.championUserId);
        cy.apiAddWarPrefight(s.memberData.access_token, s.allianceId, s.warId, 1, s.prefightChampionUserId, 10);

        cy.goToWarMode(s.ownerData.user_id, mode);
        cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
        cy.get('[data-cy="prefight-entry-node-10"]').should('be.visible');

        remove();

        cy.get('[data-cy="prefight-entry-node-10"]').should('not.exist');
      });
    });
  });
});
