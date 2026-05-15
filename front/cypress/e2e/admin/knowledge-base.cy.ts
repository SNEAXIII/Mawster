import { setupAdmin } from '../../support/e2e';

describe('Admin — knowledge base panel', () => {
  beforeEach(() => {
    cy.truncateDb();
    setupAdmin('kb-admin').then(({ user_id }) => {
      cy.apiLogin(user_id);
    });
  });

  it('knowledge base panel is visible', () => {
    cy.navTo('admin');
    cy.getByCy('tab-knowledge-base').click();
    cy.getByCy('knowledge-base-panel').should('be.visible');
  });

  it('click refresh wars button → result message visible', () => {
    cy.navTo('admin');
    cy.getByCy('tab-knowledge-base').click();
    cy.getByCy('refresh-wars-btn').click();
    cy.getByCy('refresh-wars-btn').should('not.be.disabled');
    cy.getByCy('knowledge-base-panel').should('contain.text', '0');
  });

  it('stats table shows empty state when no alliances', () => {
    cy.navTo('admin');
    cy.getByCy('tab-knowledge-base').click();
    cy.getByCy('snapshot-stats-table').should('not.exist');
    cy.getByCy('knowledge-base-panel').find('p').should('be.visible');
  });
});
