import {
  setupUser,
  setupDefenseOwner,
  setupActiveDefense,
  setupOwnerMemberAlliance,
  openWarNode,
  seedDefender,
} from '../../support/e2e';

describe('Defense – Permissions', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Clear All button visibility
  // =========================================================================

  it('clear all button is hidden when no defenders are placed', () => {
    setupUser('def-perm-clr-empty-tok').then(({ user_id, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'ClrEmptyOwn', true).then((acc) => {
        cy.apiCreateAlliance(access_token, 'ClrEmptyAll', 'CE', acc.id).then((alliance) =>
          cy.apiCreatePlan(access_token, alliance.id, 1, 'Plan 1'),
        );
      });
      cy.apiLogin(user_id, 'defense');
      cy.getByCy('defense-clear-all').should('not.exist');
    });
  });

  it('clear all button is visible when defenders are placed (owner)', () => {
    setupDefenseOwner('def-perm-clr', 'ClrOwnPlyr', 'ClrOwnAll', 'CO').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        seedDefender({
          adminToken: adminData.access_token,
          ownerToken: ownerData.access_token,
          allianceId,
          gameAccountId: ownerAccId,
          name: 'Spider-Man',
          championClass: 'Cosmic',
        });

        cy.apiLogin(ownerData.user_id, 'defense');
        cy.getByCy('defense-clear-all').should('be.visible');
      },
    );
  });

  it('a regular member reads the active plan without clear, plan or template controls', () => {
    setupActiveDefense('def-perm-clr-mem').then(({ memberData, ownerPseudo }) => {
      cy.apiLogin(memberData.user_id, 'defense');

      cy.getByCy('war-node-1').should('contain', ownerPseudo);
      cy.getByCy('defense-export-map-btn').should('be.visible');
      cy.getByCy('defense-clear-all').should('not.exist');
      cy.getByCy('plan-select').should('not.exist');
      cy.getByCy('defense-tab-templates').should('not.exist');
    });
  });

  // =========================================================================
  // Export buttons visibility
  // =========================================================================

  it('export buttons are visible for a regular member', () => {
    setupOwnerMemberAlliance('def-perm-exp-mem', 'ExpMemOwn', 'ExpMember', 'ExpMemAll', 'EM').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id, 'defense');

      cy.getByCy('defense-no-active-plan').should('be.visible');
      cy.getByCy('defense-export-map-btn').should('be.visible');
      cy.getByCy('defense-export-list-btn').should('be.visible');
    });
  });

  // =========================================================================
  // Clicking empty node: member vs. owner/officer
  // =========================================================================

  it('clicking an empty node does NOT open champion selector for a regular member', () => {
    setupOwnerMemberAlliance('def-perm-click', 'ClickOwn', 'ClickMem', 'ClickAll', 'CK').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id, 'defense');

      openWarNode(1);
      // Selector dialog should NOT appear
      cy.contains('Select Champion').should('not.exist');
    });
  });

  it('clicking an empty node opens champion selector for the owner', () => {
    setupDefenseOwner('def-perm-click-own', 'ClickOwn2', 'ClickAll2', 'C2').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        // Load a champion so the selector won't be empty
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3'),
        );
        cy.apiCreatePlan(ownerData.access_token, allianceId, 1, 'Plan 1');

        cy.apiLogin(ownerData.user_id, 'defense');

        cy.getByCy('war-node-5').click();
        cy.contains('Select Champion').should('be.visible');
        cy.contains('Node #5').should('be.visible');
      },
    );
  });
});
