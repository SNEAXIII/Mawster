import { BACKEND, setupAdmin, setupUser } from '../../support/e2e';

const CHARTS = ['login-stats-chart-month', 'login-stats-chart-weekday', 'login-stats-chart-hour'] as const;

// Totals reload on every filter change: re-query instead of holding a detached node.
function totalAccountsAtLeastOne() {
  cy.get('[data-cy="login-stats-total-accounts"]').should(($els) => {
    expect(Number($els.first().text())).to.be.gte(1);
  });
}

function chartsRendered() {
  cy.getByCy('login-stats-panel').should('be.visible');
  cy.getByCy('login-stats-charts').should('be.visible');
  // Old charts stay on screen while a reload runs: wait until the new data has landed.
  cy.getByCy('login-stats-charts').should('have.attr', 'aria-busy', 'false');
  CHARTS.forEach((chart) => {
    cy.getByCy(chart).should('be.visible');
    cy.getByCy(`${chart}-empty`).should('not.exist');
  });
}

function pick(trigger: string, option: string) {
  cy.getByCy(trigger).click();
  cy.getByCy(option).should('be.visible').click();
}

describe('Admin — login activity', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('admin sees the totals and the three charts on the Logins tab', () => {
    setupAdmin('login-stats-admin').then((admin) => {
      cy.apiLogin(admin.user_id, 'admin');
      cy.getByCy('tab-logins').click();

      chartsRendered();
      totalAccountsAtLeastOne();
      cy.get('[data-cy="login-stats-total-events"]').should(($els) => {
        expect(Number($els.first().text())).to.be.gte(1);
      });
    });
  });

  it('changing period and kind keeps the panel rendered', () => {
    setupAdmin('login-stats-filters').then((admin) => {
      cy.request('POST', `${BACKEND}/auth/refresh`, { refresh_token: admin.refresh_token });
      cy.apiLogin(admin.user_id, '/admin?tab=logins');
      chartsRendered();

      pick('login-stats-period', 'login-stats-period-30');
      chartsRendered();
      totalAccountsAtLeastOne();

      pick('login-stats-kind', 'login-stats-kind-refresh');
      chartsRendered();
      totalAccountsAtLeastOne();

      pick('login-stats-kind', 'login-stats-kind-login');
      chartsRendered();
      totalAccountsAtLeastOne();

      pick('login-stats-period', 'login-stats-period-all');
      pick('login-stats-kind', 'login-stats-kind-all');
      chartsRendered();
      totalAccountsAtLeastOne();
    });
  });

  it('a non-admin reaches neither the tab nor the endpoint', () => {
    setupUser('login-stats-user').then((user) => {
      cy.apiRequest(user.access_token, 'GET', '/admin/logins/stats', undefined, { failOnStatusCode: false }).then(
        (res) => {
          expect(res.status).to.eq(403);
        },
      );

      cy.apiLogin(user.user_id, '/admin?tab=logins');
      cy.url().should('not.include', '/admin');
      cy.getByCy('login-stats-panel').should('not.exist');
    });
  });
});
