import { BACKEND, setupAdmin, setupUser } from '../../support/e2e';

const SUPER_ADMIN = 'audit-super-admin';
const AUDIT_ROUTE = '/admin/audit-entries';
const SEASON_CALL = 'POST /admin/seasons';
const REFUSED_CALL = `GET ${AUDIT_ROUTE}`;
const PURGE_CALL = `DELETE ${AUDIT_ROUTE}`;
// Later than every entry: a purge dated in the past deletes nothing.
const FUTURE_DAY = '2099-01-01';

function setupSuperAdmin() {
  return cy.apiBatchSetup([{ discord_token: SUPER_ADMIN, role: 'super_admin' }]).then((users) => users[SUPER_ADMIN]);
}

function refusedCall(token: string) {
  cy.apiRequest(token, 'GET', AUDIT_ROUTE, undefined, { failOnStatusCode: false }).its('status').should('eq', 403);
}

/** Exact content of the list, in any order: entries of one second have no stable order. */
function rowsShown(...calls: string[]) {
  cy.get('[data-cy^="audit-row"]').should(($els) => {
    expect($els).to.have.length(calls.length);
    Object.entries(Cypress._.countBy(calls)).forEach(([call, count]) => {
      expect($els.filter(`:contains("${call}")`), call).to.have.length(count);
    });
  });
}

function pick(trigger: string, option: string) {
  cy.getByCy(trigger).click();
  cy.getByCy(option).should('be.visible').click();
}

function purge(scope: 'anonymous' | 'users' | 'admins') {
  cy.getByCy('audit-purge').click();
  cy.getByCy('audit-purge-dialog').should('be.visible');
  cy.getByCy('confirmation-dialog-confirm').should('be.disabled');
  cy.getByCy('audit-purge-before').type(FUTURE_DAY);
  cy.getByCy('confirmation-dialog-confirm').should('be.disabled');
  pick('audit-purge-scope', `audit-purge-scope-${scope}`);
  cy.getByCy('confirmation-dialog-confirm').click();
}

/** One entry per scope: a super admin's call, a player's refused one and a tokenless one. */
function setupEveryScope() {
  return setupSuperAdmin().then((superAdmin) => {
    cy.apiCreateSeason(superAdmin.access_token, 1);
    setupUser('audit-player').then((player) => refusedCall(player.access_token));
    cy.request({ url: `${BACKEND}${AUDIT_ROUTE}`, failOnStatusCode: false })
      .its('status')
      .should('eq', 401);
    cy.apiLogin(superAdmin.user_id, '/admin?tab=audit');
    rowsShown(SEASON_CALL, REFUSED_CALL, REFUSED_CALL);
  });
}

describe('Admin — audit', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('super admin opens the Audit tab and expands a row', () => {
    setupSuperAdmin().then((superAdmin) => {
      cy.apiCreateSeason(superAdmin.access_token, 42);
      cy.apiLogin(superAdmin.user_id, 'admin');
      cy.getByCy('tab-audit').click();
      cy.getByCy('audit-panel').should('be.visible');
      rowsShown(SEASON_CALL);
      cy.getByCy('audit-details').should('not.exist');

      cy.getByCy('audit-toggle').click();
      cy.getByCy('audit-details').should('be.visible').and('contain.text', '"number": 42');

      cy.getByCy('audit-toggle').click();
      cy.getByCy('audit-details').should('not.exist');
    });
  });

  it('filters narrow the list down to the empty state', () => {
    setupSuperAdmin().then((superAdmin) => {
      setupAdmin('audit-plain-admin').then((admin) => {
        cy.apiCreateSeason(superAdmin.access_token, 1);
        refusedCall(admin.access_token);
        cy.apiLogin(superAdmin.user_id, '/admin?tab=audit');
        rowsShown(SEASON_CALL, REFUSED_CALL);

        pick('audit-filter-result', 'audit-filter-result-refused');
        rowsShown(REFUSED_CALL);
        pick('audit-filter-result', 'audit-filter-result-all');
        rowsShown(SEASON_CALL, REFUSED_CALL);

        pick('audit-filter-router', 'audit-filter-router-Season');
        rowsShown(SEASON_CALL);

        pick('audit-filter-account', `audit-filter-account-${admin.user_id}`);
        cy.getByCy('audit-empty').should('be.visible');
      });
    });
  });

  it('the anonymous purge keeps the other scopes, its own entry included', () => {
    setupEveryScope();
    purge('anonymous');
    rowsShown(SEASON_CALL, REFUSED_CALL, PURGE_CALL);
  });

  it('the users purge keeps the other scopes, its own entry included', () => {
    setupEveryScope();
    purge('users');
    rowsShown(SEASON_CALL, REFUSED_CALL, PURGE_CALL);
  });

  it('the admins purge keeps the other scopes and leaves its own', () => {
    setupEveryScope();
    purge('admins');
    rowsShown(REFUSED_CALL, REFUSED_CALL, PURGE_CALL);

    // GET and DELETE share this route: only the method tells them apart.
    pick('audit-filter-route', `audit-filter-route-${PURGE_CALL}`);
    rowsShown(PURGE_CALL);
  });

  it('a plain admin reaches neither the tab nor the endpoint', () => {
    setupAdmin('audit-plain-admin').then((admin) => {
      refusedCall(admin.access_token);
      cy.apiLogin(admin.user_id, '/admin?tab=audit');
      cy.getByCy('tab-logins').should('be.visible');
      cy.getByCy('tab-audit').should('not.exist');
      cy.getByCy('audit-panel').should('not.exist');
    });
  });
});
