import { setupDefenseOwner } from '../../support/e2e';

describe('Defense – Clear All', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('Clear All resets all defender counts to zero', () => {
    setupDefenseOwner('def-op-clr', 'ClearPlyr', 'ClearAll', 'CA').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampions(adminData.access_token, [
          { name: 'Spider-Man', cls: 'Cosmic' },
          { name: 'Wolverine', cls: 'Mutant' },
        ]).then((champMap) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champMap['Spider-Man'].id, '7r5').then((cu) =>
            cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId),
          );
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champMap['Wolverine'].id, '7r4').then((cu) =>
            cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 2, cu.id, ownerAccId),
          );
        });

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('defender-count-ClearPlyr').should('contain', '2/5');

        cy.getByCy('defense-clear-all').click();
        cy.contains('button', 'Confirm').click();

        cy.getByCy('defender-count-ClearPlyr').should('contain', '0/5');
        cy.contains('Defense cleared').should('be.visible');
      },
    );
  });

  it('Clear All empties all nodes on the war map', () => {
    setupDefenseOwner('def-op-clrmap', 'ClrMapPlyr', 'ClrMapAll', 'CM').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5')
            .then((cu) => cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 10, cu.id, ownerAccId)),
        );

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('war-node-10').should('contain', 'ClrMapPlyr');

        cy.getByCy('defense-clear-all').click();
        cy.contains('button', 'Confirm').click();

        cy.getByCy('war-node-10').should('contain', '+');
      },
    );
  });

  it("Clear All shows 'No defenders placed.' in side panel", () => {
    setupDefenseOwner('def-op-clrempty', 'ClrEmptyPlyr', 'ClrEmptyAll', 'CE').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3')
            .then((cu) => cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)),
        );

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('defense-clear-all').click();
        cy.contains('button', 'Confirm').click();

        cy.contains('No defenders placed.').scrollIntoView().should('be.visible');
      },
    );
  });

  it('Clear All confirmation dialog can be cancelled', () => {
    setupDefenseOwner('def-op-clrcancel', 'ClrCancelPlyr', 'ClrCancelAll', 'CC').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3')
            .then((cu) => cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)),
        );

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('defender-count-ClrCancelPlyr').should('contain', '1/5');

        cy.getByCy('defense-clear-all').click();
        // Dismiss without confirming (press Escape)
        cy.get('body').type('{esc}');

        // Defenders remain intact
        cy.getByCy('defender-count-ClrCancelPlyr').should('contain', '1/5');
      },
    );
  });
});
