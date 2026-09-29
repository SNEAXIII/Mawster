import {
  setupAllianceOwner,
  setupActiveDefense,
  confirmAction,
  submitNameDialog as submitName,
} from '../../support/e2e';

describe('Defense – plans', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows the plan quota on the create button and counts a new plan', () => {
    setupAllianceOwner('def-plans-quota', 'PlanOwner', 'PlanAlliance', 'PQ').then(({ userData }) => {
      cy.apiLogin(userData.user_id, 'defense');
      cy.getByCy('plan-quota').should('have.text', '0/10');
      cy.getByCy('plan-create-btn').click();
      submitName('Rush');
      cy.getByCy('plan-quota').should('have.text', '1/10');
      cy.getByCy('plan-state-badge').should('be.visible');
    });
  });

  it('keeps the regular plan when switching to big thing and back', () => {
    setupAllianceOwner('def-plans-format', 'FmtOwner', 'FmtAlliance', 'FM').then(({ userData, allianceId }) => {
      cy.apiCreatePlan(userData.access_token, allianceId, 1, 'Regular plan');
      cy.apiLogin(userData.user_id, 'defense');
      cy.getByCy('plan-select').should('contain.text', 'Regular plan');
      cy.getByCy('defense-format-big_thing').click();
      cy.getByCy('plan-quota').should('have.text', '0/10');
      cy.getByCy('defense-format-regular').click();
      cy.getByCy('plan-select').should('contain.text', 'Regular plan');
    });
  });

  it('duplicates, renames and deletes a plan', () => {
    setupAllianceOwner('def-plans-crud', 'CrudOwner', 'CrudAlliance', 'CR').then(({ userData, allianceId }) => {
      cy.apiCreatePlan(userData.access_token, allianceId, 1, 'Alpha');
      cy.apiLogin(userData.user_id, 'defense');

      cy.getByCy('plan-duplicate-btn').click();
      submitName('Beta');
      cy.getByCy('plan-quota').should('have.text', '2/10');
      cy.getByCy('plan-select').should('contain.text', 'Beta');

      cy.getByCy('plan-rename-btn').click();
      submitName('Gamma');
      cy.getByCy('plan-select').should('contain.text', 'Gamma');

      confirmAction('plan-delete-btn');
      cy.getByCy('plan-quota').should('have.text', '1/10');
      cy.getByCy('plan-select').should('contain.text', 'Alpha');
    });
  });

  it('activates a validated plan', () => {
    setupActiveDefense('def-plans-activate', { activate: false }).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'defense');
      cy.getByCy('plan-active-badge').should('not.exist');
      cy.getByCy('plan-activate-btn').should('be.enabled').click();
      cy.getByCy('plan-active-badge').should('be.visible');
      cy.getByCy('plan-activate-btn').should('not.exist');
    });
  });

  it('keeps an incomplete plan from being activated', () => {
    setupAllianceOwner('def-plans-pending', 'PendOwner', 'PendAlliance', 'PD').then(({ userData, allianceId }) => {
      cy.apiCreatePlan(userData.access_token, allianceId, 1, 'Draft');
      cy.apiLogin(userData.user_id, 'defense');
      cy.getByCy('plan-activate-btn').should('be.disabled');
    });
  });
});
