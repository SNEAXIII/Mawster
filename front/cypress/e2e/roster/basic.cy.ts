import { setupUser, setupRosterUser } from '../../support/e2e';

describe('Roster – Basic', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Basic rendering
  // =========================================================================

  it('shows no-accounts message when user has no game accounts', () => {
    setupUser('roster-noacc-token').then(({ user_id }) => {
      cy.apiLogin(user_id);
      cy.navTo('roster');
      cy.contains('No game accounts yet. Add one to get started!').should('be.visible');
    });
  });

  it('shows empty roster message', () => {
    setupUser('roster-empty-token').then(({ user_id, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'EmptyRoster', true);

      cy.apiLogin(user_id);
      cy.navTo('roster');
      cy.contains('roster is empty').should('be.visible');
    });
  });

  it('shows account selector when user has multiple accounts', () => {
    setupUser('roster-multi-token').then(({ user_id, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'Account1', true);
      cy.apiCreateGameAccount(access_token, 'Account2', false);

      cy.apiLogin(user_id);
      cy.navTo('roster');
      cy.contains('Select a game account').should('be.visible');
    });
  });

  // =========================================================================
  // Add champion
  // =========================================================================

  it('shows multiple results and allows selecting one when search matches two champions', () => {
    setupRosterUser('roster-multi-result', 'RosterMulti').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'SpiderA', 'Science');
      cy.apiLoadChampion(adminData.access_token, 'SpiderB', 'Tech');

      cy.apiLogin(userData.user_id);
      cy.navTo('roster');

      cy.contains('Add / Update a Champion').click();
      cy.getByCy('champion-search').type('Spider');

      // Two results shown — no auto-select
      cy.getByCy('champion-result-SpiderA').should('be.visible');
      cy.getByCy('champion-result-SpiderB').should('be.visible');

      // Click SpiderA
      cy.getByCy('champion-result-SpiderA').click();
      cy.getByCy('champion-submit').should('not.be.disabled');

      // Search bar filled with clicked champion name and preview visible
      cy.getByCy('champion-search').should('have.value', 'SpiderA');
      cy.getByCy('champion-selected-preview').should('be.visible').and('contain', 'SpiderA').and('contain', 'Science');

      cy.getByCy('rarity-6r4').click();
      cy.getByCy('champion-submit').click();
      cy.contains('SpiderA added / updated').should('be.visible');
    });
  });

  it('opens the Add Champion form and searches for a champion', () => {
    setupRosterUser('roster-add', 'RosterPlayer').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Science');

      cy.apiLogin(userData.user_id);
      cy.navTo('roster');

      cy.contains('Add / Update a Champion').click();
      cy.getByCy('champion-search').type('Spider');
      cy.contains('Spider-Man').should('be.visible');
    });
  });

  it('adds a champion to the roster', () => {
    setupRosterUser('roster-addchamp', 'WolverinePlayer').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant');

      cy.apiLogin(userData.user_id);
      cy.navTo('roster');

      cy.contains('Add / Update a Champion').click();
      cy.getByCy('champion-search').type('Wolverine');
      cy.getByCy('champion-submit').should('not.be.disabled');

      // Search bar auto-filled and preview visible below selector
      cy.getByCy('champion-search').should('have.value', 'Wolverine');
      cy.getByCy('champion-selected-preview').should('be.visible').and('contain', 'Wolverine').and('contain', 'Mutant');

      cy.getByCy('rarity-6r4').click();
      cy.getByCy('champion-submit').click();

      cy.contains('Wolverine added / updated').should('be.visible');
      cy.contains('Wolverine').should('exist');
    });
  });

  // =========================================================================
  // Delete champion
  // =========================================================================

  it('deletes a champion from the roster', () => {
    setupRosterUser('roster-del', 'HulkPlayer').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'HulkDel', 'Science');

      cy.apiLogin(userData.user_id);
      cy.navTo('roster');

      // Add champion first
      cy.contains('Add / Update a Champion').click();
      cy.getByCy('champion-search').type('HulkDel');
      cy.getByCy('champion-submit').should('not.be.disabled');
      cy.getByCy('rarity-6r4').click();
      cy.getByCy('champion-submit').click();
      cy.contains('HulkDel added / updated').should('be.visible');

      // Now delete
      cy.getByCy('champion-delete').first().click({ force: true });
      cy.get('[role="alertdialog"]').should('be.visible').contains('button', 'Delete').click();
      cy.contains('HulkDel removed from roster').should('be.visible');
    });
  });

});
