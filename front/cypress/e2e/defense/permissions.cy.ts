import { setupUser, setupDefenseOwner, setupDefenseOwnerAndMember, setupOwnerMemberAlliance } from '../../support/e2e';

describe('Defense – Permissions', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Export / Import button visibility
  // =========================================================================

  it('export and import buttons are visible to the alliance owner', () => {
    setupUser('def-perm-owner-tok').then(({ user_id, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'PermOwner', true).then((acc) => {
        cy.apiCreateAlliance(access_token, 'PermOwnerAll', 'PO', acc.id);
      });
      cy.apiLogin(user_id);
      cy.navTo('defense');
      cy.getByCy('defense-export').should('be.visible');
      cy.getByCy('defense-import').should('be.visible');
    });
  });

  it('export and import buttons are hidden from a regular member', () => {
    setupOwnerMemberAlliance('def-perm-hid', 'PermHidOwn', 'PermHidMem', 'PermHidAll', 'PH').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id);
      cy.navTo('defense');
      cy.getByCy('defense-export').should('not.exist');
      cy.getByCy('defense-import').should('not.exist');
    });
  });

  it('export and import buttons are visible to an officer', () => {
    setupOwnerMemberAlliance('def-perm-off', 'PermOffOwn', 'PermOfficer', 'PermOffAll', 'PF').then(
      ({ ownerData, memberData, allianceId, memberAccId }) => {
        cy.apiAddOfficer(ownerData.access_token, allianceId, memberAccId);
        cy.apiLogin(memberData.user_id);
        cy.navTo('defense');
        cy.getByCy('defense-export').should('be.visible');
        cy.getByCy('defense-import').should('be.visible');
      },
    );
  });

  // =========================================================================
  // Clear All button visibility
  // =========================================================================

  it('clear all button is hidden when no defenders are placed', () => {
    setupUser('def-perm-clr-empty-tok').then(({ user_id, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'ClrEmptyOwn', true).then((acc) => {
        cy.apiCreateAlliance(access_token, 'ClrEmptyAll', 'CE', acc.id);
      });
      cy.apiLogin(user_id);
      cy.navTo('defense');
      cy.getByCy('defense-clear-all').should('not.exist');
    });
  });

  it('clear all button is visible when defenders are placed (owner)', () => {
    setupDefenseOwner('def-perm-clr', 'ClrOwnPlyr', 'ClrOwnAll', 'CO').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3')
            .then((cu) => cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)),
        );

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');
        cy.getByCy('defense-clear-all').should('be.visible');
      },
    );
  });

  it('clear all button is hidden from a regular member even with placements', () => {
    setupDefenseOwnerAndMember('def-perm-clr-mem', 'ClrMemOwn', 'ClrMember', 'ClrMemAll', 'CM').then(
      ({ adminData, ownerData, memberData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3')
            .then((cu) => cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)),
        );

        cy.apiLogin(memberData.user_id);
        cy.navTo('defense');
        cy.getByCy('defense-clear-all').should('not.exist');
      },
    );
  });

  // =========================================================================
  // Clicking empty node: member vs. owner/officer
  // =========================================================================

  it('clicking an empty node does NOT open champion selector for a regular member', () => {
    setupOwnerMemberAlliance('def-perm-click', 'ClickOwn', 'ClickMem', 'ClickAll', 'CK').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id);
      cy.navTo('defense');

      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
      // Selector dialog should NOT appear
      cy.contains('Select Champion').should('not.exist');
    });
  });

  it('clicking an empty node opens champion selector for the owner', () => {
    setupDefenseOwner('def-perm-click-own', 'ClickOwn2', 'ClickAll2', 'C2').then(
      ({ adminData, ownerData, ownerAccId }) => {
        // Load a champion so the selector won't be empty
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3'),
        );

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-5').click();
        cy.contains('Select Champion').should('be.visible');
        cy.contains('Node #5').should('be.visible');
      },
    );
  });
});
