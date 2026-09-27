import { setupDefenseOwner, confirmAction, openWarNode, submitNameDialog as submitName } from '../../support/e2e';

describe('Defense – templates', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('creates a plan from a template and keeps the champion without player', () => {
    setupDefenseOwner('def-tpl-plan', 'TplOwner', 'TplAlliance', 'TP').then(({ adminData, ownerData, allianceId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant');
      cy.apiCreateTemplate(ownerData.access_token, allianceId, 'Rush');
      cy.apiLogin(ownerData.user_id, 'defense');

      cy.getByCy('defense-tab-templates').click();
      cy.getByCy('template-quota').should('have.text', '1/15');
      openWarNode(12);
      cy.getByCy('template-champion-search').type('Wolverine');
      cy.getByCy('template-champion-option-Wolverine').click();
      cy.getByCy('war-node-12').should('have.attr', 'title').and('include', 'Wolverine');

      cy.getByCy('war-node-remove-12').focus().click();
      cy.getByCy('war-node-12').should('contain', '+');

      openWarNode(12);
      cy.getByCy('template-champion-search').type('Wolverine');
      cy.getByCy('template-champion-option-Wolverine').click();
      cy.getByCy('war-node-12').should('have.attr', 'title').and('include', 'Wolverine');

      cy.getByCy('defense-tab-plans').click();
      cy.getByCy('plan-create-btn').click();
      cy.getByCy('name-dialog-input').type('From Rush');
      cy.getByCy('plan-create-template-select').click();
      cy.getByCy('plan-create-template-Rush').click();
      cy.getByCy('name-dialog-submit').click();
      cy.getByCy('plan-select').should('contain.text', 'From Rush');
      cy.getByCy('war-node-unassigned-12').scrollIntoView().should('be.visible');
    });
  });

  it('creates, renames and deletes a template', () => {
    setupDefenseOwner('def-tpl-crud', 'TplCrudOwner', 'TplCrudAll', 'TC').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'defense');
      cy.getByCy('defense-tab-templates').click();
      cy.getByCy('template-quota').should('have.text', '0/15');

      cy.getByCy('template-create-btn').click();
      submitName('Rush');
      cy.getByCy('template-quota').should('have.text', '1/15');
      cy.getByCy('template-select').should('contain.text', 'Rush');

      cy.getByCy('template-rename-btn').click();
      submitName('Blitz');
      cy.getByCy('template-select').should('contain.text', 'Blitz');

      confirmAction('template-delete-btn');
      cy.getByCy('template-quota').should('have.text', '0/15');
      cy.getByCy('template-delete-btn').should('not.exist');
    });
  });
});
