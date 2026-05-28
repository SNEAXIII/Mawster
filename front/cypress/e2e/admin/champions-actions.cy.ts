import { setupAdmin } from '../../support/e2e';

describe('Admin — champion alias & delete actions', () => {
  let adminToken: string;

  beforeEach(() => {
    cy.truncateDb();
    setupAdmin('champ-actions-admin').then(({ access_token, user_id }) => {
      adminToken = access_token;
      cy.apiLogin(user_id);
    });
  });

  it('click edit alias → input appears', () => {
    cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('edit-alias-Iron Man').click();
      cy.getByCy('alias-input').should('be.visible');
    });
  });

  it('type alias → save → alias shown in row', () => {
    cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('edit-alias-Iron Man').click();
      cy.getByCy('alias-input').clear().type('IM;Tony');
      cy.getByCy('save-alias').click();
      cy.getByCy('champion-row-Iron Man').should('contain.text', 'IM;Tony');
    });
  });

  it('click edit alias → cancel → input disappears, alias unchanged', () => {
    cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('edit-alias-Iron Man').click();
      cy.getByCy('alias-input').type('should-not-save');
      cy.getByCy('cancel-alias').click();
      cy.getByCy('alias-input').should('not.exist');
      cy.getByCy('champion-row-Iron Man').should('not.contain.text', 'should-not-save');
    });
  });

  it('click delete → confirmation dialog appears', () => {
    cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('delete-champion-Iron Man').click();
      cy.getByCy('confirmation-dialog-confirm').should('be.visible');
    });
  });

  it('confirm delete → champion removed from list', () => {
    cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('delete-champion-Iron Man').click();
      cy.getByCy('confirmation-dialog-confirm').click();
      cy.getByCy('champion-row-Iron Man').should('not.exist');
    });
  });
});
