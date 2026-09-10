import { setupAdmin } from '../../support/e2e';

describe('Admin — champion class chips', () => {
  let adminToken: string;

  beforeEach(() => {
    cy.truncateDb();
    setupAdmin('class-chip-admin').then(({ access_token, user_id }) => {
      adminToken = access_token;
      cy.apiLogin(user_id);
    });
  });

  it('names the class on every champion row', () => {
    cy.apiLoadChampions(adminToken, [
      { name: 'Iron Man', cls: 'Tech' },
      { name: 'Wolverine', cls: 'Mutant' },
    ]).then(() => {
      cy.goToAdminChampionsTab();

      cy.getByCy('champion-row-Iron Man').find('[data-cy="class-chip-Tech"]').should('have.text', 'Tech');
      cy.getByCy('champion-row-Wolverine').find('[data-cy="class-chip-Mutant"]').should('have.text', 'Mutant');
    });
  });
});
