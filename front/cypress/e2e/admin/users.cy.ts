import { setupUser, BACKEND } from '../../support/e2e';

describe('Admin — users panel', () => {
  let superAdminToken: string;
  let superAdminUserId: string;
  let regularUserId: string;
  let regularUserLogin: string;

  beforeEach(() => {
    cy.truncateDb();
    cy.apiBatchSetup([
      { discord_token: 'users-super-admin', role: 'super_admin' },
    ]).then((users) => {
      superAdminToken = users['users-super-admin'].access_token;
      superAdminUserId = users['users-super-admin'].user_id;
      setupUser('users-regular-user').then(({ user_id, login }) => {
        regularUserId = user_id;
        regularUserLogin = login;
        cy.apiLogin(superAdminUserId);
      });
    });
  });

  it('user list visible with correct role badge', () => {
    cy.navTo('admin');
    cy.getByCy('tab-users').click();
    cy.getByCy(`user-row-${regularUserLogin}`).should('be.visible');
    cy.getByCy(`role-badge-${regularUserLogin}`).should('contain.text', 'user');
  });

  it('promote user → role badge changes to admin', () => {
    cy.navTo('admin');
    cy.getByCy('tab-users').click();
    cy.getByCy(`user-row-${regularUserLogin}`).find('button').first().click();
    cy.getByCy(`promote-${regularUserLogin}`).click();
    cy.getByCy('confirmation-dialog-confirm').click();
    cy.getByCy(`role-badge-${regularUserLogin}`).should('contain.text', 'admin');
  });

  it('demote admin → role badge changes back to user', () => {
    cy.request({
      method: 'PATCH',
      url: `${BACKEND}/admin/users/promote/${regularUserId}`,
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    cy.navTo('admin');
    cy.getByCy('tab-users').click();
    cy.getByCy(`user-row-${regularUserLogin}`).find('button').first().click();
    cy.getByCy(`demote-${regularUserLogin}`).click();
    cy.getByCy('confirmation-dialog-confirm').click();
    cy.getByCy(`role-badge-${regularUserLogin}`).should('contain.text', 'user');
  });

  it('disable user → row shows disabled state', () => {
    cy.navTo('admin');
    cy.getByCy('tab-users').click();
    cy.getByCy(`user-row-${regularUserLogin}`).find('button').first().click();
    cy.getByCy(`disable-${regularUserLogin}`).click();
    cy.getByCy('confirmation-dialog-confirm').click();
    cy.getByCy(`user-row-${regularUserLogin}`).should('contain.text', 'Disabled');
  });

  it('enable user → row returns to enabled state', () => {
    cy.request({
      method: 'PATCH',
      url: `${BACKEND}/admin/users/disable/${regularUserId}`,
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    cy.navTo('admin');
    cy.getByCy('tab-users').click();
    cy.getByCy(`user-row-${regularUserLogin}`).find('button').first().click();
    cy.getByCy(`enable-${regularUserLogin}`).click();
    cy.getByCy('confirmation-dialog-confirm').click();
    cy.getByCy(`user-row-${regularUserLogin}`).should('contain.text', 'Enabled');
  });

  it('delete user → confirmation dialog → row shows deleted state', () => {
    cy.navTo('admin');
    cy.getByCy('tab-users').click();
    cy.getByCy(`user-row-${regularUserLogin}`).find('button').first().click();
    cy.getByCy(`delete-user-${regularUserLogin}`).click();
    cy.getByCy('confirmation-dialog-confirm').click();
    cy.getByCy(`user-row-${regularUserLogin}`).should('contain.text', 'Deleted');
  });
});
