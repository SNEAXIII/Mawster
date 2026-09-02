import { setupDefenseOwner, openWarNode } from '../../support/e2e';

describe('Defense – Remove defender', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('removes a defender from side panel and counter decrements', () => {
    setupDefenseOwner('def-op-rm', 'RmPlyr', 'RmAll', 'RM').then(({ adminData, ownerData, allianceId, ownerAccId }) => {
      cy.apiLoadChampions(adminData.access_token, [
        { name: 'Spider-Man', cls: 'Cosmic' },
        { name: 'Wolverine', cls: 'Mutant' },
      ]).then((champMap) => {
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champMap['Spider-Man'].id, '7r5', {
          signature: 200,
        }).then((cu) => cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId));
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champMap['Wolverine'].id, '7r4', {
          signature: 100,
        }).then((cu) => cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 2, cu.id, ownerAccId));
      });

      cy.apiLogin(ownerData.user_id, 'defense');

      cy.getByCy('defender-count-RmPlyr').should('contain', '2/5');

      // force: the X only appears on hover
      cy.getByCy('remove-defender-1').focus().click();

      cy.getByCy('defender-count-RmPlyr').should('contain', '1/5');
      cy.contains('Defender removed').should('be.visible');
    });
  });

  it('removes a defender from the war map red X button', () => {
    setupDefenseOwner('def-op-rmmap', 'RmMapPlyr', 'RmMapAll', 'RX').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5', {
              signature: 200,
            })
            .then((cu) => cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 5, cu.id, ownerAccId)),
        );

        cy.apiLogin(ownerData.user_id, 'defense');

        cy.getByCy('defender-count-RmMapPlyr').should('contain', '1/5');

        // Remove via the war map X button (force because hidden until hover)
        cy.getByCy('war-node-5').find('button').focus().click();

        cy.getByCy('defender-count-RmMapPlyr').should('contain', '0/5');
        cy.getByCy('war-node-5').should('contain', '+');
        cy.contains('Defender removed').should('be.visible');
      },
    );
  });

  it('after removing a defender it reappears in the champion selector', () => {
    setupDefenseOwner('def-op-rmreapp', 'RmReappPlyr', 'RmReappAll', 'RR').then(
      ({ adminData, ownerData, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3'),
        );

        cy.apiLogin(ownerData.user_id, 'defense');

        // Place via UI
        openWarNode(1);
        cy.getByCy('champion-card-Spider-Man').click();
        cy.getByCy('defender-count-RmReappPlyr').should('contain', '1/5');

        // Spider-Man should NOT appear in selector for another node
        openWarNode(2);
        cy.getByCy('champion-card-Spider-Man').should('not.exist');
        cy.get('body').type('{esc}');

        // Remove Spider-Man via side panel
        cy.getByCy('remove-defender-1').focus().click();
        cy.getByCy('defender-count-RmReappPlyr').should('contain', '0/5');

        // Spider-Man should reappear in selector
        openWarNode(2);
        cy.getByCy('champion-card-Spider-Man').should('be.visible');
      },
    );
  });
});
