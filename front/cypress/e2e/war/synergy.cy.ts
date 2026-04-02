import { setupAttackerScenario } from '../../support/e2e';

describe('War Synergy', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('adds a synergy champion via the popover and shows the badge', () => {
    setupAttackerScenario('syn1').then(
      ({ adminToken, ownerData, memberData, allianceId, memberAccId, warId, championUserId }) => {
        // Assign node attacker first
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        // Load a synergy champion
        cy.apiLoadChampion(adminToken, 'Deadpool', 'Mutant').then((champs) => {
          const synChamp = champs[0];
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, synChamp.id, '7r3').then(
            (synCu) => {
              // Visit war page
              cy.visit('/game/war');
              cy.getByCy('war-attacker-panel').should('be.visible');

              // Click the attacker portrait to open synergy popover
              cy.getByCy('synergy-trigger-Wolverine').click();

              // Add synergy
              cy.getByCy('synergy-add-Wolverine').click();

              // Pick Deadpool in selector
              cy.getByCy('synergy-selector').should('be.visible');
              cy.getByCy('synergy-pick-Deadpool').click();

              // Badge should now be visible on the Wolverine portrait
              cy.getByCy('synergy-trigger-Wolverine').find('[title]').should('exist');
            },
          );
        });
      },
    );
  });

  it('revokes a synergy champion via the popover', () => {
    setupAttackerScenario('syn2').then(
      ({ adminToken, ownerData, memberData, allianceId, memberAccId, warId, championUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        cy.apiLoadChampion(adminToken, 'Deadpool', 'Mutant').then((champs) => {
          const synChamp = champs[0];
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, synChamp.id, '7r3').then(
            (synCu) => {
              cy.apiAddWarSynergy(
                memberData.access_token,
                allianceId,
                warId,
                1,
                synCu.id,
                championUserId,
              );

              cy.visit('/game/war');
              cy.getByCy('war-attacker-panel').should('be.visible');

              // Open popover on the node attacker
              cy.getByCy('synergy-trigger-Wolverine').click();

              // Revoke
              cy.getByCy('synergy-revoke-Wolverine').click();

              // Badge should be gone
              cy.getByCy('synergy-trigger-Wolverine').should('not.contain', 'Deadpool');
            },
          );
        });
      },
    );
  });

  it('enforces 3-slot limit when combining node attackers and synergy', () => {
    setupAttackerScenario('syn3').then(
      ({ adminToken, ownerData, memberData, allianceId, memberAccId, ownerAccId, warId, championUserId }) => {
        // Assign first node attacker (Wolverine on node 10)
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        cy.apiLoadChampion(adminToken, 'Black Panther', 'Cosmic').then((champs1) => {
          // Place defender on node 11 and assign second attacker
          cy.apiPlaceWarDefender(ownerData.access_token, allianceId, warId, 1, 11, champs1[0].id, 7, 3, 0);
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs1[0].id, '7r3').then(
            (cu2) => {
              cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 11, cu2.id);

              cy.apiLoadChampion(adminToken, 'Captain Marvel', 'Cosmic').then((champs2) => {
                // Place defender on node 12 and assign third attacker
                cy.apiPlaceWarDefender(ownerData.access_token, allianceId, warId, 1, 12, champs2[0].id, 7, 3, 0);
                cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs2[0].id, '7r3').then(
                  (cu3) => {
                    cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 12, cu3.id);

                    // Now try to add a 4th via synergy → backend should 409
                    cy.apiLoadChampion(adminToken, 'Thor', 'Cosmic').then((champs3) => {
                      cy.apiAddChampionToRoster(
                        memberData.access_token,
                        memberAccId,
                        champs3[0].id,
                        '7r3',
                      ).then((cu4) => {
                        cy.request({
                          method: 'POST',
                          url: `${Cypress.env('backendUrl') ?? 'http://localhost:8001'}/alliances/${allianceId}/wars/${warId}/bg/1/synergy`,
                          headers: { Authorization: `Bearer ${memberData.access_token}` },
                          body: {
                            champion_user_id: cu4.id,
                            target_champion_user_id: championUserId,
                          },
                          failOnStatusCode: false,
                        }).then((res) => {
                          expect(res.status).to.eq(409);
                        });
                      });
                    });
                  },
                );
              });
            },
          );
        });
      },
    );
  });
});
