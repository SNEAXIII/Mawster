import { setupAdmin } from '../../support/e2e';

const CHAMPION = 'Iron Man';

describe('Admin — champion alias & delete actions', () => {
  // Every test works on the same champion from the champions tab, so the whole
  // setup — admin, login, champion, tab — lives in beforeEach.
  beforeEach(() => {
    cy.truncateDb();
    setupAdmin('champ-actions-admin').then(({ access_token, user_id }) => {
      cy.apiLogin(user_id);
      cy.apiLoadChampion(access_token, CHAMPION, 'Tech');
      cy.goToAdminChampionsTab();
    });
  });

  it('click edit alias → input appears', () => {
    cy.getByCy(`edit-alias-${CHAMPION}`).click();
    cy.getByCy('alias-input').should('be.visible');
  });

  it('type alias → save → alias shown in row', () => {
    cy.getByCy(`edit-alias-${CHAMPION}`).click();
    cy.getByCy('alias-input').clear().type('IM;Tony');
    cy.getByCy('save-alias').click();
    cy.getByCy(`champion-row-${CHAMPION}`).should('contain.text', 'IM;Tony');
  });

  it('click edit alias → cancel → input disappears, alias unchanged', () => {
    cy.getByCy(`edit-alias-${CHAMPION}`).click();
    cy.getByCy('alias-input').type('should-not-save');
    cy.getByCy('cancel-alias').click();
    cy.getByCy('alias-input').should('not.exist');
    cy.getByCy(`champion-row-${CHAMPION}`).should('not.contain.text', 'should-not-save');
  });

  it('click delete → confirmation dialog appears', () => {
    cy.getByCy(`delete-champion-${CHAMPION}`).click();
    cy.getByCy('confirmation-dialog-confirm').should('be.visible');
  });

  it('confirm delete → champion removed from list', () => {
    cy.getByCy(`delete-champion-${CHAMPION}`).click();
    cy.getByCy('confirmation-dialog-confirm').click();
    cy.getByCy(`champion-row-${CHAMPION}`).should('not.exist');
  });
});
