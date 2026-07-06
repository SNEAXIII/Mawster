import { setupAdmin } from '../../support/e2e';

describe('Admin — champion flag toggles', () => {
  let adminToken: string;

  beforeEach(() => {
    cy.truncateDb();
    setupAdmin('champ-flags-admin').then(({ access_token, user_id }) => {
      adminToken = access_token;
      cy.apiLogin(user_id);
    });
  });

  it('toggle prefight off→on shows Yes, persists on reload', () => {
    cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('toggle-prefight-Iron Man').should('contain.text', 'No');
      cy.getByCy('toggle-prefight-Iron Man').click();
      cy.getByCy('toggle-prefight-Iron Man').should('contain.text', 'Yes');
      cy.reload();
      cy.getByCy('tab-champions').click();
      cy.getByCy('toggle-prefight-Iron Man').should('contain.text', 'Yes');
    });
  });

  it('toggle prefight on→off shows No', () => {
    cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('toggle-prefight-Iron Man').click();
      cy.getByCy('toggle-prefight-Iron Man').should('contain.text', 'Yes');
      cy.getByCy('toggle-prefight-Iron Man').click();
      cy.getByCy('toggle-prefight-Iron Man').should('contain.text', 'No');
    });
  });

  it('toggle ascendable off→on shows Yes, persists on reload', () => {
    cy.apiLoadChampion(adminToken, 'Wolverine', 'Mutant').then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('toggle-ascendable-Wolverine').should('contain.text', 'No');
      cy.getByCy('toggle-ascendable-Wolverine').click();
      cy.getByCy('toggle-ascendable-Wolverine').should('contain.text', 'Yes');
      cy.reload();
      cy.getByCy('tab-champions').click();
      cy.getByCy('toggle-ascendable-Wolverine').should('contain.text', 'Yes');
    });
  });

  it('toggle ascendable on→off shows No', () => {
    cy.apiLoadChampion(adminToken, 'Wolverine', 'Mutant', { is_ascendable: true }).then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('toggle-ascendable-Wolverine').should('contain.text', 'Yes');
      cy.getByCy('toggle-ascendable-Wolverine').click();
      cy.getByCy('toggle-ascendable-Wolverine').should('contain.text', 'No');
    });
  });

  // Saga attacker/defender toggles are now scoped to a selected season
  // (see admin/saga-per-season.cy.ts).
});
