function getFixtureUserId(login: string) {
  return cy.request({ method: 'GET', url: '/api/dev/users' }).then((res) => {
    const user = (res.body as Array<{ id: string; login: string }>).find((u) => u.login === login);
    expect(user, `user ${login}`).to.exist;
    return user!.id;
  });
}

function openAttackerFilter() {
  cy.getByCy('filter-attacker').click();
  cy.get('[role="dialog"]').should('be.visible');
}

function openDefenderFilter() {
  cy.getByCy('filter-defender').click();
  cy.get('[role="dialog"]').should('be.visible');
}
describe('Knowledge base', () => {
  beforeEach(() => {
    cy.runFixtures();
  });

  it('renders real fight records and paginates', () => {
    getFixtureUserId('circle_03').then((userId) => {
      cy.apiLogin(userId);
      cy.visit('/game/knowledge-base');

      cy.getByCy('fight-records-table').should('be.visible');
      cy.getByCy('fight-records-table').find('tbody tr').should('have.length.greaterThan', 1);
      cy.getByCy('pagination-page-info').should('contain.text', 'Page 1/');
      cy.getByCy('pagination-first').should('be.disabled');
      cy.getByCy('pagination-prev').should('be.disabled');
      cy.getByCy('pagination-next').should('not.be.disabled');
      cy.getByCy('pagination-last').should('not.be.disabled');

      cy.getByCy('pagination-next').click();
      cy.getByCy('pagination-page-info').should('contain.text', 'Page 2/');
      cy.getByCy('pagination-reset').should('not.be.disabled');

      cy.getByCy('pagination-prev').click();
      cy.getByCy('pagination-page-info').should('contain.text', 'Page 1/');
      cy.getByCy('pagination-reset').should('be.disabled');
    });
  });

  it('filters by attacker and defender using real champion data', () => {
    getFixtureUserId('circle_03').then((userId) => {
      cy.apiLogin(userId);
      cy.visit('/game/knowledge-base');

      cy.getByCy('fight-records-table')
        .find('tbody tr')
        .first()
        .within(() => {
          cy.get('td').eq(0).invoke('text').as('attackerName');
          cy.get('td').eq(1).invoke('text').as('defenderName');
        });

      cy.get('@attackerName').then((attackerName) => {
        openAttackerFilter();
        cy.get('[role="dialog"]').find('input').type(String(attackerName).trim());
        cy.contains('[role="option"]', String(attackerName).trim()).click();
        cy.getByCy('fight-records-table').should('be.visible');
      });

      cy.get('@defenderName').then((defenderName) => {
        openDefenderFilter();
        cy.get('[role="dialog"]').find('input').type(String(defenderName).trim());
        cy.contains('[role="option"]', String(defenderName).trim()).click();
        cy.getByCy('fight-records-table').should('be.visible');
      });

      cy.getByCy('filter-clear').click();
      cy.getByCy('fight-records-table').should('be.visible');
    });
  });
});
