import { setupUser, setupDefenseOwner, setupDefenseOwnerAndMember } from '../../support/e2e';

describe('Defense – Overflow & Error Cases', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // 6th champion: player with 5 already placed is disabled in owner picker
  // =========================================================================

  it('owner with 5/5 defenders is filtered out — 6th champion auto-places for the remaining member', () => {
    setupDefenseOwnerAndMember('def-ov-full', 'FullOwn', 'FullMem', 'FullAll', 'FL').then(
      ({ adminData, ownerData, memberData, allianceId, ownerAccId, memberAccId }) => {
        const champDefs = [
          { name: 'Spider-Man', cls: 'Cosmic' },
          { name: 'Wolverine',  cls: 'Mutant' },
          { name: 'Iron Man',   cls: 'Tech' },
          { name: 'Doctor Doom', cls: 'Mystic' },
          { name: 'Blade',      cls: 'Skill' },
          { name: 'Hulk',       cls: 'Science' },
        ];
        const ownerCUs: string[] = [];

        cy.apiLoadChampions(adminData.access_token, champDefs).then((champMap) => {
          champDefs.forEach((def, i) => {
            cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champMap[def.name].id, '7r3')
              .then((cu) => { ownerCUs.push(cu.id); });
            // 6th champion also added to member
            if (i === 5) {
              cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champMap[def.name].id, '7r3');
            }
          });
        }).then(() => {
          ownerCUs.slice(0, 5).forEach((cuId, i) => {
            cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, i + 1, cuId, ownerAccId);
          });

          cy.uiLogin(ownerData.login);
          cy.navTo('defense');

          // Verify counter shows 5/5
          cy.getByCy('defender-count-FullOwn').scrollIntoView().should('contain', '5/5');

          // Click an empty node — only Hulk should be available (first 5 already placed)
          cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
          cy.contains('Select Champion').should('be.visible');

          // Click Hulk — owner (5/5) is filtered out by backend, so only member remains
          // With a single remaining owner the champion auto-places for the member
          cy.getByCy('champion-card-Hulk').click();
          cy.contains('Hulk placed on node #10').should('be.visible');

          // Member has 1/5
          cy.getByCy('defender-count-FullMem').scrollIntoView().should('contain', '1/5');
          // Owner still has 5/5
          cy.getByCy('defender-count-FullOwn').scrollIntoView().should('contain', '5/5');
        });
      }
    );
  });

  it('counter turns red when player has 5/5 defenders', () => {
    setupDefenseOwner('def-ov-red', 'RedCntPlyr', 'RedCntAll', 'RC').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        const champDefs = [
          { name: 'Spider-Man', cls: 'Cosmic' },
          { name: 'Wolverine',  cls: 'Mutant' },
          { name: 'Iron Man',   cls: 'Tech' },
          { name: 'Doctor Doom', cls: 'Mystic' },
          { name: 'Blade',      cls: 'Skill' },
        ];

        cy.apiLoadChampions(adminData.access_token, champDefs).then((champMap) => {
          champDefs.forEach((def, i) => {
            cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champMap[def.name].id, '7r3')
              .then((cu) => {
                cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, i + 1, cu.id, ownerAccId);
              });
          });
        }).then(() => {
          cy.uiLogin(ownerData.login);
          cy.navTo('defense');

          // Counter should be red (text-red-400 CSS class)
          cy.getByCy('defender-count-RedCntPlyr')
            .should('contain', '5/5')
            .and('have.class', 'text-red-400');
        });
      }
    );
  });

  it('counter is NOT red when player has fewer than 5/5 defenders', () => {
    setupDefenseOwner('def-ov-norm', 'NormCntPlyr', 'NormCntAll', 'NC').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3')
            .then((cu) =>
              cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
            )
        );

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('defender-count-NormCntPlyr')
          .should('contain', '1/5')
          .and('not.have.class', 'text-red-400');
      }
    );
  });

  // =========================================================================
  // Champion selector: no champions available
  // =========================================================================

  it("shows 'No champions available' when roster is empty", () => {
    setupUser('def-ov-empty-own-tok').then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'EmptyRosterOwn', true).then((acc) => {
        cy.apiCreateAlliance(access_token, 'EmptyRosterAll', 'ER', acc.id).then((alliance) => {
          cy.apiSetMemberGroup(access_token, alliance.id, acc.id, 1);

          cy.uiLogin(login);
          cy.navTo('defense');

          cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
          cy.contains('No champions available').should('be.visible');
        });
      });
    });
  });

  it("shows 'No champions available' after all champions have been placed", () => {
    setupDefenseOwner('def-ov-allplc', 'AllPlcPlyr', 'AllPlcAll', 'AP').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3')
            .then((cu) =>
              cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
            )
        );

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        // Open selector for a different node — only champion is already placed
        cy.getByCy('war-node-2').scrollIntoView().click({ force: true });
        cy.contains('No champions available').should('be.visible');
      }
    );
  });

  // =========================================================================
  // Owner picker: back button
  // =========================================================================

  it('back button in owner picker returns to champion grid', () => {
    setupDefenseOwnerAndMember('def-ov-back', 'BackOwn', 'BackMem', 'BackAll', 'BK').then(
      ({ adminData, ownerData, memberData, ownerAccId, memberAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
          return cy.apiAddChampionToRoster(
            memberData.access_token,
            memberAccId,
            champs[0].id,
            '7r4'
          );
        });

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.contains('Select Champion').should('be.visible');
        cy.getByCy('champion-card-Spider-Man').click();
        cy.contains('Select Player').should('be.visible');

        // Click back button (← Back)
        cy.contains('button', '←').click();

        // Should be back on champion grid
        cy.contains('Select Champion').should('be.visible');
        cy.getByCy('champion-card-Spider-Man').should('be.visible');
      }
    );
  });

  // =========================================================================
  // Selector dialog: closing without placing
  // =========================================================================

  it('closing the selector dialog without selecting does not place anything', () => {
    setupDefenseOwner('def-ov-close', 'ClosePlyr', 'CloseAll', 'CL').then(
      ({ adminData, ownerData, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3')
        );

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.contains('Select Champion').should('be.visible');

        // Close the dialog by pressing Escape
        cy.get('body').type('{esc}');
        cy.contains('Select Champion').should('not.exist');

        // Node should still be empty
        cy.getByCy('war-node-1').should('contain', '+');
        cy.getByCy('defender-count-ClosePlyr').should('contain', '0/5');
      }
    );
  });

  // =========================================================================
  // Single owner: direct placement (no owner picker)
  // =========================================================================

  it('single-owner champion places directly without showing owner picker', () => {
    setupDefenseOwner('def-ov-direct', 'DirectPlyr', 'DirectAll', 'DR').then(
      ({ adminData, ownerData, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5', {
            signature: 200,
          })
        );

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Spider-Man').click();

        // Should directly place without showing "Select Player"
        cy.contains('Select Player').should('not.exist');
        cy.contains('Spider-Man placed on node #1').should('be.visible');
        cy.getByCy('defender-count-DirectPlyr').should('contain', '1/5');
      }
    );
  });

  // =========================================================================
  // Champion selector: champion card shows owner count
  // =========================================================================

  it('champion card in selector shows owner count when multi-owner', () => {
    setupDefenseOwnerAndMember('def-ov-cnt', 'CntOwn', 'CntMem', 'CntAll', 'CN').then(
      ({ adminData, ownerData, memberData, ownerAccId, memberAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
          return cy.apiAddChampionToRoster(
            memberData.access_token,
            memberAccId,
            champs[0].id,
            '7r4'
          );
        });
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) =>
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3')
        );

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });

        // Spider-Man has 2 owners → shows "2 owners"
        cy.getByCy('champion-card-Spider-Man').should('contain', '2 owners');

        // Wolverine has 1 owner → shows pseudo and count
        cy.getByCy('champion-card-Wolverine').should('contain', 'CntOwn');
        cy.getByCy('champion-card-Wolverine').should('contain', '0/5');
      }
    );
  });
});
