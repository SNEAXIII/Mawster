import { setupUser, setupDefenseOwner } from '../../support/e2e';

describe('Defense – Export', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('export returns JSON with champion_name, node_number and owner_name', () => {
    setupDefenseOwner('def-op-exp', 'ExportPlyr', 'ExportAll', 'EP').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5', {
              signature: 200,
            })
            .then((cu) => cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)),
        );

        cy.intercept('GET', `**/alliances/${allianceId}/defense/bg/1/export`).as('exportReq');

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('defense-export').click();
        cy.wait('@exportReq').then((interception) => {
          expect(interception.response?.statusCode).to.eq(200);
          const body = interception.response?.body as Array<Record<string, unknown>>;
          expect(body).to.be.an('array').with.length(1);
          expect(body[0]).to.have.property('champion_name', 'Spider-Man');
          expect(body[0]).to.have.property('node_number', 1);
          expect(body[0]).to.have.property('owner_name', 'ExportPlyr');
          expect(body[0]).to.have.property('rarity', '7r5');
        });
      },
    );
  });

  it('export shows warning toast when no defenders to export', () => {
    setupUser('def-op-exp-empty-tok').then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'ExpEmptyPlyr', true).then((acc) => {
        cy.apiCreateAlliance(access_token, 'ExpEmptyAll', 'EE', acc.id);
      });

      cy.uiLogin(login);
      cy.navTo('defense');

      cy.getByCy('defense-export').click();
      cy.contains('No defenders to export').should('be.visible');
    });
  });

  it('export with multiple placements returns all champions', () => {
    setupDefenseOwner('def-op-expmulti', 'ExpMultiPlyr', 'ExpMultiAll', 'EM').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampions(adminData.access_token, [
          { name: 'Spider-Man', cls: 'Cosmic' },
          { name: 'Wolverine', cls: 'Mutant' },
        ]).then((champMap) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champMap['Spider-Man'].id, '7r5').then((cu) =>
            cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId),
          );
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champMap['Wolverine'].id, '7r4').then((cu) =>
            cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 10, cu.id, ownerAccId),
          );
        });

        cy.intercept('GET', `**/alliances/${allianceId}/defense/bg/1/export`).as('exportMulti');

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('defense-export').click();
        cy.wait('@exportMulti').then((interception) => {
          const body = interception.response?.body as Array<Record<string, unknown>>;
          expect(body).to.have.length(2);
          const names = body.map((b) => b.champion_name);
          expect(names).to.include('Spider-Man');
          expect(names).to.include('Wolverine');
          const nodes = body.map((b) => b.node_number);
          expect(nodes).to.include(1);
          expect(nodes).to.include(10);
        });
      },
    );
  });
});
