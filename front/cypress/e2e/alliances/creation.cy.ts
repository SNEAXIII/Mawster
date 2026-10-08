import { setupUser, type UserSetupData } from '../../support/e2e';

describe('Alliances – Creation', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows the alliances page title', () => {
    setupUser('alliance-page-token').then(({ user_id }) => {
      cy.apiLogin(user_id, 'alliances');
      cy.contains('Alliances').should('be.visible');
    });
  });

  it('shows empty state when user has no game accounts', () => {
    setupUser('alliance-noacc-token').then(({ user_id }) => {
      cy.apiLogin(user_id, 'alliances');
      cy.contains('Browse and create alliances for your alliance wars.').should('be.visible');
      cy.contains('No alliances yet. Create the first one!').should('be.visible');
    });
  });

  it('creates an alliance via the UI form and verifies displayed content', () => {
    setupUser('alliance-create-token').then(({ user_id, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'AllianceLeader', true);

      cy.apiLogin(user_id, 'alliances');

      cy.getByCy('tab-create').click();
      cy.getByCy('alliance-name-input').should('be.visible').type('TestAlliance');
      cy.getByCy('alliance-tag-input').type('TA');
      cy.getByCy('alliance-create-btn').click();

      cy.contains('Alliance created successfully').should('be.visible');
      cy.getByCy('alliance-card-TestAlliance').should('be.visible');
      cy.getByCy('alliance-card-TestAlliance').within(() => {
        cy.getByCy('alliance-name').should('contain', 'TestAlliance');
        cy.getByCy('alliance-tag').should('contain', '[TA]');
        cy.getByCy('alliance-officer-count').should('contain', '0 officers');
        cy.contains('AllianceLeader').should('be.visible');
      });
    });
  });

  it('shows alliance members with correct roles after creation', () => {
    setupUser('alliance-members-token').then(({ user_id, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'LeaderAcc', true).then((account) => {
        cy.apiCreateAlliance(access_token, 'MyAlliance', 'MA', account.id);
      });

      cy.apiLogin(user_id, 'alliances');

      cy.getByCy('alliance-card-MyAlliance')
        .should('be.visible')
        .within(() => {
          cy.getByCy('alliance-name').should('contain', 'MyAlliance');
          cy.getByCy('alliance-tag').should('contain', '[MA]');
          cy.contains('Members').should('be.visible');
          cy.getByCy('member-row-LeaderAcc').should('be.visible');
          cy.getByCy('member-row-LeaderAcc').should('contain', 'LeaderAcc');
        });
    });
  });

  // =========================================================================
  // Validation
  // =========================================================================

  it('shows validation error when alliance name is too short', () => {
    setupUser('alliance-nameinv-token').then(({ user_id, access_token }: UserSetupData) => {
      cy.apiCreateGameAccount(access_token, 'LeaderNameInv', true);

      cy.apiLogin(user_id, 'alliances');

      cy.getByCy('tab-create').click();
      cy.getByCy('alliance-name-input').type('AB');
      cy.getByCy('alliance-tag-input').type('BA');
      cy.getByCy('alliance-create-btn').click();

      cy.contains('Invalid name: 3 to 25 characters, no emoji').should('be.visible');
      cy.contains('Alliance created').should('not.exist');
    });
  });

  it('caps the name at 25 characters and the tag at 5', () => {
    setupUser('alliance-max-token').then(({ user_id, access_token }: UserSetupData) => {
      cy.apiCreateGameAccount(access_token, 'LeaderMax', true);

      cy.apiLogin(user_id, 'alliances');

      cy.getByCy('tab-create').click();
      cy.getByCy('alliance-name-input').type('A'.repeat(30));
      cy.getByCy('alliance-name-input').should('have.value', 'A'.repeat(25));
      cy.getByCy('alliance-tag-input').type('ABCDEFG');
      cy.getByCy('alliance-tag-input').should('have.value', 'ABCDE');
    });
  });

  it('creates an alliance whose name and tag hold special characters and spaces', () => {
    setupUser('alliance-special-token').then(({ user_id, access_token }: UserSetupData) => {
      cy.apiCreateGameAccount(access_token, 'LeaderSpecial', true);

      cy.apiLogin(user_id, 'alliances');

      cy.getByCy('tab-create').click();
      cy.getByCy('alliance-name-input').type('Ŧhé-Ållîance ★');
      cy.getByCy('alliance-tag-input').type('Ø ★');
      cy.getByCy('alliance-create-btn').click();

      cy.getByCy('alliance-card-Ŧhé-Ållîance ★').within(() => {
        cy.getByCy('alliance-tag').should('contain', '[Ø ★]');
      });
    });
  });

  it('shows the empty state when user has game accounts but no alliances', () => {
    setupUser('alliance-empty-token').then(({ user_id, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'EmptyAcc', true);
      cy.apiLogin(user_id, 'alliances');
      cy.getByCy('alliance-empty-text').should('contain', 'No alliances yet');
    });
  });
});
