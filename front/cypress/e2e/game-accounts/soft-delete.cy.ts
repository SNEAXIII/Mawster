import { setupUser, setupAllianceOwner } from '../../support/e2e';

describe('Game Accounts – soft delete & restore', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  const openDeleteDialog = (pseudo: string) => {
    cy.getByCy(`account-row-${pseudo}`).find('[data-cy="account-delete-btn"]').click({ force: true });
    cy.get('[role="alertdialog"]').should('be.visible');
  };

  // =========================================================================
  // Confirmation by account name
  // =========================================================================

  it('keeps the confirm button disabled until the account name is typed', () => {
    setupUser('ga-soft-confirm-token').then(({ user_id, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'Careful', true);
      cy.apiLogin(user_id, 'profile');

      openDeleteDialog('Careful');
      cy.getByCy('confirmation-dialog-confirm').should('be.disabled');

      cy.getByCy('confirm-text-input').type('Carefu');
      cy.getByCy('confirmation-dialog-confirm').should('be.disabled');

      cy.getByCy('confirm-text-input').type('l');
      cy.getByCy('confirmation-dialog-confirm').should('not.be.disabled');
    });
  });

  // =========================================================================
  // Deleted accounts are restorable
  // =========================================================================

  it('moves a deleted account to the restorable list', () => {
    setupUser('ga-soft-list-token').then(({ user_id, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'Ghost', true);
      cy.apiLogin(user_id, 'profile');

      openDeleteDialog('Ghost');
      cy.getByCy('confirm-text-input').type('Ghost');
      cy.getByCy('confirmation-dialog-confirm').click();

      cy.getByCy('deleted-accounts-section').should('be.visible');
      cy.getByCy('deleted-account-row-Ghost').should('be.visible');
      cy.getByCy('deleted-account-days-left-Ghost').should('contain', '7');
    });
  });

  it('restores a deleted account', () => {
    setupUser('ga-soft-restore-token').then(({ user_id, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'BackSoon', true);
      cy.apiLogin(user_id, 'profile');

      openDeleteDialog('BackSoon');
      cy.getByCy('confirm-text-input').type('BackSoon');
      cy.getByCy('confirmation-dialog-confirm').click();
      cy.getByCy('deleted-account-row-BackSoon').should('be.visible');

      cy.getByCy('account-restore-btn-BackSoon').click({ force: true });

      cy.contains('Game account restored').should('be.visible');
      cy.getByCy('account-row-BackSoon').should('be.visible');
      cy.getByCy('deleted-account-row-BackSoon').should('not.exist');
    });
  });

  // =========================================================================
  // Quota
  // =========================================================================

  it('keeps counting a deleted account in the 10-account quota', () => {
    setupUser('ga-soft-quota-token').then(({ user_id, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'SlotHolder', true);
      cy.apiLogin(user_id, 'profile');
      cy.contains('1/10 accounts').should('be.visible');

      openDeleteDialog('SlotHolder');
      cy.getByCy('confirm-text-input').type('SlotHolder');
      cy.getByCy('confirmation-dialog-confirm').click();

      cy.getByCy('deleted-account-row-SlotHolder').should('be.visible');
      cy.contains('1/10 accounts').should('be.visible');
    });
  });

  // =========================================================================
  // Alliance guard
  // =========================================================================

  it('refuses to delete an account that still belongs to an alliance', () => {
    setupAllianceOwner('ga-soft-alliance', 'Leader', 'Mighty Warriors', 'MW').then(({ userData }) => {
      cy.apiLogin(userData.user_id, 'profile');

      openDeleteDialog('Leader');
      cy.getByCy('confirm-text-input').type('Leader');
      cy.getByCy('confirmation-dialog-confirm').click();

      cy.contains('still tied to an alliance').should('be.visible');
      cy.getByCy('account-row-Leader').should('be.visible');
      cy.getByCy('deleted-account-row-Leader').should('not.exist');
    });
  });
});
