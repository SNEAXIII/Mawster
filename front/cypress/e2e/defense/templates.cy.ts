import { setupDefenseOwner, confirmAction, openWarNode, submitNameDialog as submitName } from '../../support/e2e';

const pickTemplateChampion = (node: number, name: string) => {
  openWarNode(node);
  cy.getByCy('template-champion-search').type(name);
  cy.getByCy(`template-champion-option-${name}`).click();
  cy.getByCy(`war-node-${node}`).should('have.attr', 'title').and('include', name);
};

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
      pickTemplateChampion(12, 'Wolverine');

      cy.getByCy('war-node-remove-12').focus().click();
      cy.getByCy('war-node-12').should('contain', '+');

      pickTemplateChampion(12, 'Wolverine');

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

  it('counts only champions with a player and frames the unassigned one', () => {
    setupDefenseOwner('def-tpl-count', 'TplCntOwner', 'TplCntAll', 'TN').then(
      ({ adminData, ownerData, allianceId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant');
        cy.apiCreateTemplate(ownerData.access_token, allianceId, 'Rush');
        cy.apiLogin(ownerData.user_id, 'defense');

        cy.getByCy('defense-tab-templates').click();
        pickTemplateChampion(12, 'Wolverine');

        cy.getByCy('defense-tab-plans').click();
        cy.getByCy('plan-create-btn').click();
        cy.getByCy('name-dialog-input').type('From Rush');
        cy.getByCy('plan-create-template-select').click();
        cy.getByCy('plan-create-template-Rush').click();
        cy.getByCy('name-dialog-submit').click();

        cy.getByCy('war-node-unassigned-12').should('exist');
        cy.getByCy('plan-state-progress')
          .invoke('text')
          .should('match', /^0\/\d+$/);

        openWarNode(12);
        cy.getByCy('defense-current-placement')
          .find('img')
          .first()
          .should('have.attr', 'src', '/static/frame/7_stars.webp');
      },
    );
  });

  it('hides a champion already placed on another node of the template', () => {
    setupDefenseOwner('def-tpl-dup', 'TplDupOwner', 'TplDupAll', 'TD').then(({ adminData, ownerData, allianceId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant');
      cy.apiLoadChampion(adminData.access_token, 'Hulk', 'Science');
      cy.apiCreateTemplate(ownerData.access_token, allianceId, 'Rush');
      cy.apiLogin(ownerData.user_id, 'defense');

      cy.getByCy('defense-tab-templates').click();
      pickTemplateChampion(12, 'Wolverine');

      openWarNode(13);
      cy.getByCy('template-champion-option-Hulk').should('be.visible');
      cy.getByCy('template-champion-option-Wolverine').should('not.exist');
      cy.get('body').type('{esc}');

      openWarNode(12);
      cy.getByCy('template-champion-option-Wolverine').should('be.visible');
    });
  });

  it('hides the battlegroup selector on the templates tab', () => {
    setupDefenseOwner('def-tpl-bg', 'TplBgOwner', 'TplBgAll', 'TB').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'defense');
      cy.getByCy('defense-bg-1').should('be.visible');

      cy.getByCy('defense-tab-templates').click();
      cy.getByCy('defense-bg-1').should('not.exist');
      cy.getByCy('defense-format-regular').should('be.visible');

      cy.getByCy('defense-tab-plans').click();
      cy.getByCy('defense-bg-1').should('be.visible');
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
