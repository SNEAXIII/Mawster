import { setupWarOwner } from '../../support/e2e';

describe('War – Duplicate defender placement', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('same champion can be placed as defender on two different nodes', () => {
    setupWarOwner('war-dup-def', 'DupDefPlayer', 'DupDefAlliance', 'DD').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });

        cy.apiCreateWar(ownerData.access_token, allianceId, 'DupEnemy');

        cy.apiLogin(ownerData.user_id);
        cy.navTo('war');
        cy.getByCy('war-mode-defenders').click();

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('war-champion-card-Spider-Man').click();
        cy.getByCy('war-confirm-place').click();
        cy.contains('Spider-Man placed on node #1').should('be.visible');

        cy.getByCy('war-node-2').scrollIntoView().click({ force: true });
        cy.getByCy('war-champion-card-Spider-Man').should('be.visible');
        cy.getByCy('war-champion-card-Spider-Man').click();
        cy.getByCy('war-confirm-place').click();
        cy.contains('Spider-Man placed on node #2').should('be.visible');

        cy.getByCy('war-node-1').should('have.attr', 'title').and('include', 'Spider-Man');
        cy.getByCy('war-node-2').should('have.attr', 'title').and('include', 'Spider-Man');
      },
    );
  });

  it('same champion remains visible in selector after first war node placement', () => {
    setupWarOwner('war-dup-vis', 'DupVisPlayer', 'DupVisAlliance', 'DV').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampions(adminData.access_token, [
          { name: 'Spider-Man', cls: 'Cosmic' },
          { name: 'Wolverine', cls: 'Mutant' },
        ]).then((champMap) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champMap['Spider-Man'].id, '7r3');
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champMap['Wolverine'].id, '7r3');
        });

        cy.apiCreateWar(ownerData.access_token, allianceId, 'DupVisEnemy');

        cy.apiLogin(ownerData.user_id);
        cy.navTo('war');
        cy.getByCy('war-mode-defenders').click();

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('war-champion-card-Spider-Man').click();
        cy.getByCy('war-confirm-place').click();
        cy.contains('Spider-Man placed on node #1').should('be.visible');

        cy.getByCy('war-node-2').scrollIntoView().click({ force: true });
        cy.getByCy('war-champion-card-Spider-Man').should('be.visible');
        cy.getByCy('war-champion-card-Wolverine').should('be.visible');
      },
    );
  });
});
