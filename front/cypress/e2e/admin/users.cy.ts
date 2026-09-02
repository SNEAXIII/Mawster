import { setupUser, confirmAction } from '../../support/e2e';

// Every row action follows the same shape: optionally put the user in the state
// the action needs, run it from the row menu, then assert the row's new state.
const ROW_ACTIONS = [
  {
    title: 'promote user → role badge changes to admin',
    setup: null,
    action: 'promote',
    target: 'role-badge',
    expected: 'admin',
  },
  {
    title: 'demote admin → role badge changes back to user',
    setup: 'promote',
    action: 'demote',
    target: 'role-badge',
    expected: 'user',
  },
  {
    title: 'disable user → row shows disabled state',
    setup: null,
    action: 'disable',
    target: 'user-row',
    expected: 'Disabled',
  },
  {
    title: 'enable user → row returns to enabled state',
    setup: 'disable',
    action: 'enable',
    target: 'user-row',
    expected: 'Enabled',
  },
  {
    title: 'delete user → confirmation dialog → row shows deleted state',
    setup: null,
    action: 'delete-user',
    target: 'user-row',
    expected: 'Deleted',
  },
] as const;

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
    confirmAction(`${action}-${regularUserLogin}`);
  }

  // Put the user in the state an action needs, without going through the UI.
  function adminPatch(action: 'promote' | 'disable') {
    cy.apiRequest(superAdminToken, 'PATCH', `/admin/users/${action}/${regularUserId}`);
  }

  it('user list visible with correct role badge', () => {
    openUsersTab();
    cy.getByCy(`user-row-${regularUserLogin}`).should('be.visible');
    cy.getByCy(`role-badge-${regularUserLogin}`).should('contain.text', 'user');
  });

  ROW_ACTIONS.forEach(({ title, setup, action, target, expected }) => {
    it(title, () => {
      if (setup) adminPatch(setup);
      runRowAction(action);
      cy.getByCy(`${target}-${regularUserLogin}`).should('contain.text', expected);
    });
  });
});
