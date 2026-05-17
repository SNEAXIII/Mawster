import { BACKEND, setupAttackerScenario } from '../../support/e2e';

function loadTwoChampsAddToRoster(
  adminToken: string,
  token: string,
  accId: string,
  name1: string,
  cls1: string,
  name2: string,
  cls2: string,
  cb: (args: { cu1: { id: string }; cu2: { id: string } }) => void,
) {
  cy.apiLoadChampion(adminToken, name1, cls1).then((champs1: { id: string }[]) => {
    cy.apiAddChampionToRoster(token, accId, champs1[0].id, '7r3').then((cu1: { id: string }) => {
      cy.apiLoadChampion(adminToken, name2, cls2).then((champs2: { id: string }[]) => {
        cy.apiAddChampionToRoster(token, accId, champs2[0].id, '7r3').then((cu2: { id: string }) => {
          cb({ cu1, cu2 });
        });
      });
    });
  });
}

function setupThreeAttackers(
  adminToken: string,
  ownerToken: string,
  memberToken: string,
  memberAccId: string,
  allianceId: string,
  warId: string,
  cb: (cu4Id: string) => void,
) {
  cy.apiLoadChampions(adminToken, [
    { name: 'Black Panther', cls: 'Cosmic' },
    { name: 'Captain Marvel', cls: 'Cosmic' },
    { name: 'Thor', cls: 'Cosmic' },
  ]).then((champMap: Record<string, { id: string }>) => {
    cy.apiPlaceWarDefender(ownerToken, allianceId, warId, 1, 11, champMap['Black Panther'].id, 7, 3, 0);
    cy.apiPlaceWarDefender(ownerToken, allianceId, warId, 1, 12, champMap['Captain Marvel'].id, 7, 3, 0);
    cy.apiAddChampionToRoster(memberToken, memberAccId, champMap['Black Panther'].id, '7r3').then(
      (cu2: { id: string }) => {
        cy.apiAssignWarAttacker(memberToken, allianceId, warId, 1, 11, cu2.id);
        cy.apiAddChampionToRoster(memberToken, memberAccId, champMap['Captain Marvel'].id, '7r3').then(
          (cu3: { id: string }) => {
            cy.apiAssignWarAttacker(memberToken, allianceId, warId, 1, 12, cu3.id);
            cy.apiAddChampionToRoster(memberToken, memberAccId, champMap['Thor'].id, '7r3').then(
              (cu4: { id: string }) => {
                cb(cu4.id);
              },
            );
          },
        );
      },
    );
  });
}

function openSynergyWithDeadpoolAndStorm(
  adminToken: string,
  memberToken: string,
  memberUserId: string,
  memberAccId: string,
  allianceId: string,
  warId: string,
  championUserId: string,
  cb: () => void,
) {
  cy.apiAssignWarAttacker(memberToken, allianceId, warId, 1, 10, championUserId);
  loadTwoChampsAddToRoster(adminToken, memberToken, memberAccId, 'Deadpool', 'Mutant', 'Storm', 'Mutant', () => {
    cy.apiLogin(memberUserId);
    cy.visit('/game/war');
    cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
    cy.getByCy('synergy-trigger-Wolverine').click();
    cy.getByCy('synergy-add-Wolverine').click();
    cy.getByCy('synergy-selector').should('be.visible');
    cb();
  });
}

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
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, synChamp.id, '7r3').then((synCu) => {
            // Visit war page
            cy.apiLogin(memberData.user_id);
            cy.visit('/game/war');
            cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');

            // Click the attacker portrait to open synergy popover
            cy.getByCy('synergy-trigger-Wolverine').click();

            // Add synergy
            cy.getByCy('synergy-add-Wolverine').click();

            // Pick Deadpool in selector
            cy.getByCy('synergy-selector').should('be.visible');
            cy.getByCy('synergy-pick-Deadpool').click();

            cy.getByCy('champion-portrait-Deadpool-synergy').scrollIntoView().should('be.visible');

            // Synergy provider should now appear in the popover trigger
            cy.getByCy('synergy-trigger-Wolverine').click();
            cy.getByCy('synergy-provider-Deadpool').should('be.visible');
          });
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
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, synChamp.id, '7r3').then((synCu) => {
            cy.apiAddWarSynergy(memberData.access_token, allianceId, warId, 1, synCu.id, championUserId);

            cy.apiLogin(memberData.user_id);
            cy.visit('/game/war');
            cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');

            // Open popover on the node attacker
            cy.getByCy('synergy-trigger-Wolverine').click();

            // Revoke
            cy.getByCy('synergy-revoke-Deadpool').click();

            // Badge should be gone
            cy.getByCy('synergy-trigger-Wolverine').click();
            cy.getByCy('synergy-provider-Deadpool').should('not.exist');
            cy.getByCy('champion-portrait-Deadpool-synergy').should('not.exist');
          });
        });
      },
    );
  });

  it('removing attacker from last node auto-removes their synergy (couteau suisse)', () => {
    setupAttackerScenario('syn4').then(
      ({ adminToken, ownerData, memberData, allianceId, memberAccId, warId, championUserId }) => {
        const synergyUrl = `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/synergy`;

        // Assign Wolverine as node attacker on node 10
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        // Load Deadpool and assign as node attacker on node 11 (couteau suisse: node fighter + synergy provider)
        cy.apiLoadChampion(adminToken, 'Deadpool', 'Mutant').then((champs) => {
          cy.apiPlaceWarDefender(ownerData.access_token, allianceId, warId, 1, 11, champs[0].id, 7, 3, 0);
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3').then((deadpoolCu) => {
            cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 11, deadpoolCu.id);

            // Deadpool also provides synergy to Wolverine
            cy.apiAddWarSynergy(memberData.access_token, allianceId, warId, 1, deadpoolCu.id, championUserId);

            // Remove Deadpool from node 11 — their last fight
            cy.apiRemoveWarAttacker(memberData.access_token, allianceId, warId, 1, 11);

            // Synergy should be auto-removed
            cy.request({
              method: 'GET',
              url: synergyUrl,
              headers: { Authorization: `Bearer ${memberData.access_token}` },
            }).then((res) => {
              expect(res.status).to.eq(200);
              expect(res.body).to.have.length(0);
            });
          });
        });
      },
    );
  });

  it('duplicate synergy provider rejected', () => {
    setupAttackerScenario('syn5').then(({ adminToken, memberData, allianceId, memberAccId, warId, championUserId }) => {
      const synergyUrl = `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/synergy`;

      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.apiLoadChampion(adminToken, 'Deadpool', 'Mutant').then((champs) => {
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3').then((synCu) => {
          const payload = { champion_user_id: synCu.id, target_champion_user_id: championUserId };

          cy.request({
            method: 'POST',
            url: synergyUrl,
            headers: { Authorization: `Bearer ${memberData.access_token}` },
            body: payload,
          }).then((res) => expect(res.status).to.eq(201));

          cy.request({
            method: 'POST',
            url: synergyUrl,
            headers: { Authorization: `Bearer ${memberData.access_token}` },
            body: payload,
            failOnStatusCode: false,
          }).then((res) => expect(res.status).to.eq(409));
        });
      });
    });
  });

  it('target must be an assigned node attacker', () => {
    setupAttackerScenario('syn6').then(({ adminToken, memberData, allianceId, memberAccId, warId, championUserId }) => {
      const synergyUrl = `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/synergy`;

      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      // Deadpool added to roster but NOT assigned to any node; Thor as provider
      loadTwoChampsAddToRoster(
        adminToken,
        memberData.access_token,
        memberAccId,
        'Deadpool',
        'Mutant',
        'Thor',
        'Cosmic',
        ({ cu1: nonAttackerCu, cu2: providerCu }) => {
          cy.request({
            method: 'POST',
            url: synergyUrl,
            headers: { Authorization: `Bearer ${memberData.access_token}` },
            body: { champion_user_id: providerCu.id, target_champion_user_id: nonAttackerCu.id },
            failOnStatusCode: false,
          }).then((res) => {
            expect(res.status).to.eq(422);
          });
        },
      );
    });
  });

  it('enforces 3-slot limit when combining node attackers and synergy', () => {
    setupAttackerScenario('syn3').then(
      ({ adminToken, ownerData, memberData, allianceId, memberAccId, warId, championUserId }) => {
        // Assign first node attacker (Wolverine on node 10)
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        setupThreeAttackers(
          adminToken,
          ownerData.access_token,
          memberData.access_token,
          memberAccId,
          allianceId,
          warId,
          (cu4Id) => {
            // Now try to add a 4th via synergy → backend should 409
            cy.request({
              method: 'POST',
              url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/synergy`,
              headers: { Authorization: `Bearer ${memberData.access_token}` },
              body: { champion_user_id: cu4Id, target_champion_user_id: championUserId },
              failOnStatusCode: false,
            }).then((res) => {
              expect(res.status).to.eq(409);
            });
          },
        );
      },
    );
  });

  it('preferred attacker shows badge in synergy selector', () => {
    setupAttackerScenario('syn-pref-sel').then(
      ({ adminToken, memberData, memberAccId, allianceId, warId, championUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        cy.apiLoadChampion(adminToken, 'Deadpool', 'Mutant').then((champs) => {
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3', {
            is_preferred_attacker: true,
          });
        });

        cy.apiLoadChampion(adminToken, 'Storm', 'Mutant').then((champs) => {
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3', {
            is_preferred_attacker: false,
          });
        });

        cy.apiLogin(memberData.user_id);
        cy.visit('/game/war');
        cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');

        cy.getByCy('synergy-trigger-Wolverine').click();
        cy.getByCy('synergy-add-Wolverine').click();
        cy.getByCy('synergy-selector').should('be.visible');

        cy.getByCy('synergy-pick-Deadpool').find('[data-cy="preferred-badge"]').should('exist');
        cy.getByCy('synergy-pick-Storm').find('[data-cy="preferred-badge"]').should('not.exist');
      },
    );
  });

  it('search input filters synergy candidates by name', () => {
    setupAttackerScenario('syn7').then(({ adminToken, memberData, allianceId, memberAccId, warId, championUserId }) => {
      openSynergyWithDeadpoolAndStorm(
        adminToken,
        memberData.access_token,
        memberData.user_id,
        memberAccId,
        allianceId,
        warId,
        championUserId,
        () => {
          cy.getByCy('synergy-pick-Deadpool').should('be.visible');
          cy.getByCy('synergy-pick-Storm').should('be.visible');

          cy.getByCy('synergy-search').type('dead');
          cy.getByCy('synergy-pick-Deadpool').should('be.visible');
          cy.getByCy('synergy-pick-Storm').should('not.exist');
        },
      );
    });
  });

  it('does not allow selecting the same champion as synergy provider', () => {
    setupAttackerScenario('syn8').then(({ memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.apiLogin(memberData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');

      cy.getByCy('synergy-trigger-Wolverine').click();
      cy.getByCy('synergy-add-Wolverine').click();
      cy.getByCy('synergy-selector').should('be.visible');

      cy.getByCy('synergy-pick-Wolverine').should('not.exist');
    });
  });

  it('clearing the search restores the full synergy candidate list', () => {
    setupAttackerScenario('syn8').then(({ adminToken, memberData, allianceId, memberAccId, warId, championUserId }) => {
      openSynergyWithDeadpoolAndStorm(
        adminToken,
        memberData.access_token,
        memberData.user_id,
        memberAccId,
        allianceId,
        warId,
        championUserId,
        () => {
          cy.getByCy('synergy-search').type('dead');
          cy.getByCy('synergy-pick-Storm').should('not.exist');
          cy.getByCy('synergy-search').clear();

          cy.getByCy('synergy-pick-Deadpool').should('be.visible');
          cy.getByCy('synergy-pick-Storm').should('be.visible');
        },
      );
    });
  });
});
