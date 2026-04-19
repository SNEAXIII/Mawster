import { setupRosterUser } from '../../support/e2e';

describe('Mastery tab', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Empty state
  // =========================================================================

  it('shows empty state when no masteries configured', () => {
    setupRosterUser('mastery-empty', 'MasteryUser').then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.visit('/game/account?tab=mastery');
      cy.contains('No masteries configured yet').should('be.visible');
    });
  });

  // =========================================================================
  // Display with default values
  // =========================================================================

  it('shows all masteries with default 0 values when not yet saved', () => {
    setupRosterUser('mastery-defaults', 'MasteryUser').then(({ adminData, userData }) => {
      cy.apiCreateMastery(adminData.access_token, 'ASSASSIN', 5, 3);
      cy.apiCreateMastery(adminData.access_token, 'LIMBER', 3, 2);

      cy.apiLogin(userData.user_id);
      cy.visit('/game/account?tab=mastery');

      cy.getByCy('mastery-card-assassin').should('be.visible');
      cy.getByCy('mastery-card-limber').should('be.visible');
      cy.getByCy('mastery-assassin-unlocked').should('have.value', '0');
      cy.getByCy('mastery-assassin-attack').should('have.value', '0');
      cy.getByCy('mastery-assassin-defense').should('have.value', '0');
    });
  });

  // =========================================================================
  // Save masteries
  // =========================================================================

  it('owner can save masteries and values persist after reload', () => {
    setupRosterUser('mastery-save', 'MasteryUser').then(({ adminData, userData, accountId }) => {
      cy.apiCreateMastery(adminData.access_token, 'ASSASSIN', 5, 3).then((mastery) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/account?tab=mastery');

        cy.getByCy('mastery-assassin-unlocked').clear().type('4');
        cy.getByCy('mastery-assassin-attack').clear().type('3');
        cy.getByCy('mastery-assassin-defense').clear().type('2');
        cy.getByCy('mastery-save-button').click();

        cy.contains('Masteries saved').should('be.visible');

        cy.reload();
        cy.getByCy('mastery-assassin-unlocked').should('have.value', '4');
        cy.getByCy('mastery-assassin-attack').should('have.value', '3');
        cy.getByCy('mastery-assassin-defense').should('have.value', '2');
      });
    });
  });

  // =========================================================================
  // Mastery tab navigation
  // =========================================================================

  it('switches to mastery tab via tab bar', () => {
    setupRosterUser('mastery-tab-nav', 'MasteryUser').then(({ adminData, userData }) => {
      cy.apiCreateMastery(adminData.access_token, 'ASSASSIN', 5, 3);

      cy.apiLogin(userData.user_id);
      cy.visit('/game/account');
      cy.getByCy('tab-mastery').click();
      cy.getByCy('mastery-card-assassin').should('be.visible');
      cy.url().should('include', 'tab=mastery');
    });
  });

  // =========================================================================
  // Pre-saved values via API
  // =========================================================================

  it('shows pre-saved values when masteries already saved via API', () => {
    setupRosterUser('mastery-presaved', 'MasteryUser').then(({ adminData, userData, accountId }) => {
      cy.apiCreateMastery(adminData.access_token, 'ASSASSIN', 5, 3).then((mastery) => {
        cy.apiSaveMasteries(userData.access_token, accountId, [
          { mastery_id: mastery.id, unlocked: 5, attack: 4, defense: 3 },
        ]);

        cy.apiLogin(userData.user_id);
        cy.visit('/game/account?tab=mastery');

        cy.getByCy('mastery-assassin-unlocked').should('have.value', '5');
        cy.getByCy('mastery-assassin-attack').should('have.value', '4');
        cy.getByCy('mastery-assassin-defense').should('have.value', '3');
      });
    });
  });

  // =========================================================================
  // Front validation
  // =========================================================================

  it('blocks attack value exceeding unlocked', () => {
    setupRosterUser('mastery-validation', 'MasteryUser').then(({ adminData, userData }) => {
      cy.apiCreateMastery(adminData.access_token, 'ASSASSIN', 5, 3);

      cy.apiLogin(userData.user_id);
      cy.visit('/game/account?tab=mastery');

      cy.getByCy('mastery-assassin-unlocked').clear().type('3');
      cy.getByCy('mastery-assassin-attack').clear().type('5');
      cy.getByCy('mastery-assassin-attack').should('have.value', '3');
    });
  });

  it('blocks unlocked value exceeding max_value', () => {
    setupRosterUser('mastery-validation-max', 'MasteryUser').then(({ adminData, userData }) => {
      cy.apiCreateMastery(adminData.access_token, 'ASSASSIN', 5, 3);

      cy.apiLogin(userData.user_id);
      cy.visit('/game/account?tab=mastery');

      cy.getByCy('mastery-assassin-unlocked').clear().type('99');
      cy.getByCy('mastery-assassin-unlocked').should('have.value', '5');
    });
  });

  // =========================================================================
  // MAX badge
  // =========================================================================

  it('shows MAX badge when mastery is fully unlocked', () => {
    setupRosterUser('mastery-max-badge', 'MasteryUser').then(({ adminData, userData, accountId }) => {
      cy.apiCreateMastery(adminData.access_token, 'ASSASSIN', 5, 3).then((mastery) => {
        cy.apiSaveMasteries(userData.access_token, accountId, [
          { mastery_id: mastery.id, unlocked: 5, attack: 0, defense: 0 },
        ]);

        cy.apiLogin(userData.user_id);
        cy.visit('/game/account?tab=mastery');

        cy.getByCy('mastery-card-assassin').contains('MAX').should('be.visible');
      });
    });
  });

  // =========================================================================
  // Alliance member view in roster dialog
  // =========================================================================

  it('alliance member sees owner masteries in roster dialog', () => {
    cy.apiBatchSetup([
      { discord_token: 'mastery-alliance-admin', role: 'admin' },
      { discord_token: 'mastery-alliance-owner', game_pseudo: 'OwnerPseudo', create_alliance: { name: 'TestAlliance', tag: 'TA' } },
      { discord_token: 'mastery-alliance-member', game_pseudo: 'MemberPseudo', join_alliance_token: 'mastery-alliance-owner' },
    ]).then((users) => {
      const adminToken = users['mastery-alliance-admin'].access_token;
      const ownerToken = users['mastery-alliance-owner'].access_token;
      const ownerAccId = users['mastery-alliance-owner'].account_id!;
      const memberUserId = users['mastery-alliance-member'].user_id;

      cy.apiCreateMastery(adminToken, 'ASSASSIN', 5, 3).then((mastery) => {
        cy.apiSaveMasteries(ownerToken, ownerAccId, [
          { mastery_id: mastery.id, unlocked: 4, attack: 3, defense: 2 },
        ]);

        cy.apiLogin(memberUserId);
        cy.visit('/game/alliances');

        cy.getByCy('view-roster-OwnerPseudo').click();
        cy.getByCy('mastery-card-assassin').should('be.visible');
      });
    });
  });
});
