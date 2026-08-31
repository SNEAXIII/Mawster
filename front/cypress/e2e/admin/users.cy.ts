import { setupUser, BACKEND } from '../../support/e2e';

describe('Admin — users panel', () => {
  let superAdminToken: string;
  let superAdminUserId: string;
  let regularUserId: string;
  let regularUserLogin: string;

  beforeEach(() => {
    cy.truncateDb();
    cy.apiBatchSetup([{ discord_token: 'users-super-admin', role: 'super_admin' }]).then((users) => {
      superAdminToken = users['users-super-admin'].access_token;
      superAdminUserId = users['users-super-admin'].user_id;
      setupUser('users-regular-user').then(({ user_id, login }) => {
        regularUserId = user_id;
        regularUserLogin = login;
        cy.apiLogin(superAdminUserId);
      });
    });
  });

  function openUsersTab() {
    cy.navTo('admin');
    cy.getByCy('tab-users').click();
  }

  // Every row action lives behind the row's kebab menu and a confirmation dialog.
  function runRowAction(action: 'promote' | 'demote' | 'disable' | 'enable' | 'delete-user') {
    openUsersTab();
    cy.getByCy(`user-row-${regularUserLogin}`).find('button').first().click();
    cy.getByCy(`${action}-${regularUserLogin}`).click();
    cy.getByCy('confirmation-dialog-confirm').click();
  }

  // Put the user in the state an action needs, without going through the UI.
  function adminPatch(action: 'promote' | 'disable') {
    cy.request({
      method: 'PATCH',
      url: `${BACKEND}/admin/users/${action}/${regularUserId}`,
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
  }

  it('user list visible with correct role badge', () => {
    openUsersTab();
    cy.getByCy(`user-row-${regularUserLogin}`).should('be.visible');
    cy.getByCy(`role-badge-${regularUserLogin}`).should('contain.text', 'user');
  });

  it('promote user → role badge changes to admin', () => {
    runRowAction('promote');
    cy.getByCy(`role-badge-${regularUserLogin}`).should('contain.text', 'admin');
  });

  it('demote admin → role badge changes back to user', () => {
    adminPatch('promote');
    runRowAction('demote');
    cy.getByCy(`role-badge-${regularUserLogin}`).should('contain.text', 'user');
  });

  it('disable user → row shows disabled state', () => {
    runRowAction('disable');
    cy.getByCy(`user-row-${regularUserLogin}`).should('contain.text', 'Disabled');
  });

  it('enable user → row returns to enabled state', () => {
    adminPatch('disable');
    runRowAction('enable');
    cy.getByCy(`user-row-${regularUserLogin}`).should('contain.text', 'Enabled');
  });

  it('delete user → confirmation dialog → row shows deleted state', () => {
    runRowAction('delete-user');
    cy.getByCy(`user-row-${regularUserLogin}`).should('contain.text', 'Deleted');
  });
});
