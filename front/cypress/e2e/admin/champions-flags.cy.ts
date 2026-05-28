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

  it('toggle saga attacker off→on shows Yes, persists on reload', () => {
    cy.apiLoadChampion(adminToken, 'Thor', 'Cosmic').then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('toggle-saga-attacker-Thor').should('contain.text', 'No');
      cy.getByCy('toggle-saga-attacker-Thor').click();
      cy.getByCy('toggle-saga-attacker-Thor').should('contain.text', 'Yes');
      cy.reload();
      cy.getByCy('tab-champions').click();
      cy.getByCy('toggle-saga-attacker-Thor').should('contain.text', 'Yes');
    });
  });

  it('toggle saga attacker on→off shows No', () => {
    cy.apiLoadChampion(adminToken, 'Thor', 'Cosmic', { is_saga_attacker: true }).then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('toggle-saga-attacker-Thor').should('contain.text', 'Yes');
      cy.getByCy('toggle-saga-attacker-Thor').click();
      cy.getByCy('toggle-saga-attacker-Thor').should('contain.text', 'No');
    });
  });

  it('toggle saga defender off→on shows Yes, persists on reload', () => {
    cy.apiLoadChampion(adminToken, 'Hulk', 'Science').then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('toggle-saga-defender-Hulk').should('contain.text', 'No');
      cy.getByCy('toggle-saga-defender-Hulk').click();
      cy.getByCy('toggle-saga-defender-Hulk').should('contain.text', 'Yes');
      cy.reload();
      cy.getByCy('tab-champions').click();
      cy.getByCy('toggle-saga-defender-Hulk').should('contain.text', 'Yes');
    });
  });

  it('toggle saga defender on→off shows No', () => {
    cy.apiLoadChampion(adminToken, 'Hulk', 'Science', { is_saga_defender: true }).then(() => {
      cy.goToAdminChampionsTab();
      cy.getByCy('toggle-saga-defender-Hulk').should('contain.text', 'Yes');
      cy.getByCy('toggle-saga-defender-Hulk').click();
      cy.getByCy('toggle-saga-defender-Hulk').should('contain.text', 'No');
    });
  });
});
