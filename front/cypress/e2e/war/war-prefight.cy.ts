import { BACKEND, setupAttackerScenario, setupPrefightScenario } from '../../support/e2e';

describe('War Prefight', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('adds a pre-fight champion via the popover and shows the badge', () => {
    setupPrefightScenario('pf1').then(
      ({ memberData, allianceId, warId, championUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        cy.apiLogin(memberData.user_id);
        cy.visit('/game/war');
        cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');

        cy.getByCy('prefight-trigger-node-10').click();
        cy.getByCy('prefight-add-node-10').click();

        cy.getByCy('prefight-selector').should('be.visible');
        cy.getByCy('prefight-pick-Storm').click();
        cy.getByCy('prefight-selector').should('not.exist');

        cy.getByCy('prefight-trigger-node-10').find('[title]').should('exist');
      }
    );
  });

  it('revokes a pre-fight champion via the popover', () => {
    setupPrefightScenario('pf2').then(
      ({ memberData, allianceId, warId, championUserId, prefightChampionUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiAddWarPrefight(memberData.access_token, allianceId, warId, 1, prefightChampionUserId, 10);

        cy.apiLogin(memberData.user_id);
        cy.visit('/game/war');
        cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');

        cy.getByCy('prefight-trigger-node-10').click();
        cy.getByCy('prefight-revoke-Storm').click();

        cy.getByCy('prefight-trigger-node-10').find('[title]').should('not.exist');
      }
    );
  });

  it('returns 422 when no attacker is assigned on the node', () => {
    setupAttackerScenario('pf3').then(
      ({ adminToken, memberData, memberAccId, allianceId, warId }) => {
        const prefightUrl = `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/prefight`;

        cy.apiLoadChampion(adminToken, 'Storm', 'Mutant').then((champs) => {
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3').then((stormCu) => {
            cy.request({
              method: 'POST',
              url: prefightUrl,
              headers: { Authorization: `Bearer ${memberData.access_token}` },
              body: { champion_user_id: stormCu.id, target_node_number: 10 },
              failOnStatusCode: false,
            }).then((res) => {
              expect(res.status).to.eq(422);
            });
          });
        });
      }
    );
  });

  it('returns 409 on duplicate pre-fight assignment', () => {
    setupPrefightScenario('pf4').then(
      ({ memberData, allianceId, warId, championUserId, prefightChampionUserId }) => {
        const prefightUrl = `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/prefight`;
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        const payload = { champion_user_id: prefightChampionUserId, target_node_number: 10 };

        cy.request({
          method: 'POST',
          url: prefightUrl,
          headers: { Authorization: `Bearer ${memberData.access_token}` },
          body: payload,
        }).then((res) => expect(res.status).to.eq(201));

        cy.request({
          method: 'POST',
          url: prefightUrl,
          headers: { Authorization: `Bearer ${memberData.access_token}` },
          body: payload,
          failOnStatusCode: false,
        }).then((res) => expect(res.status).to.eq(409));
      }
    );
  });

  it('API — same champion can prefight two different nodes', () => {
    setupPrefightScenario('pf5').then(
      ({ adminToken, ownerData, memberData, allianceId, warId, championUserId, memberAccId, prefightChampionUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        cy.apiLoadChampion(adminToken, 'Captain Marvel', 'Cosmic').then((champs) => {
          cy.apiPlaceWarDefender(ownerData.access_token, allianceId, warId, 1, 11, champs[0].id, 7, 3, 0);
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3').then((cu) => {
            cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 11, cu.id);

            const prefightUrl = `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/prefight`;

            cy.request({
              method: 'POST',
              url: prefightUrl,
              headers: { Authorization: `Bearer ${memberData.access_token}` },
              body: { champion_user_id: prefightChampionUserId, target_node_number: 10 },
            }).then((res) => {
              expect(res.status).to.eq(201);

              cy.request({
                method: 'POST',
                url: prefightUrl,
                headers: { Authorization: `Bearer ${memberData.access_token}` },
                body: { champion_user_id: prefightChampionUserId, target_node_number: 11 },
              }).then((res2) => expect(res2.status).to.eq(201));
            });
          });
        });
      }
    );
  });

  it('API — champion without has_prefight is rejected (422)', () => {
    setupAttackerScenario('pf6').then(
      ({ adminToken, memberData, allianceId, warId, championUserId, memberAccId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs) => {
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3').then((ironManCu) => {
            cy.request({
              method: 'POST',
              url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/prefight`,
              headers: { Authorization: `Bearer ${memberData.access_token}` },
              body: { champion_user_id: ironManCu.id, target_node_number: 10 },
              failOnStatusCode: false,
            }).then((res) => expect(res.status).to.eq(422));
          });
        });
      }
    );
  });

  it('API — banned champion is excluded from available-prefight-attackers', () => {
    setupPrefightScenario('pf8').then(
      ({ ownerData, memberData, allianceId, warId }) => {
        const availableUrl = (wid: string) =>
          `${BACKEND}/alliances/${allianceId}/wars/${wid}/bg/1/available-prefight-attackers`;

        // Get Storm's champion_id from the current available list
        cy.request({
          method: 'GET',
          url: availableUrl(warId),
          headers: { Authorization: `Bearer ${memberData.access_token}` },
        }).then((res) => {
          const stormEntry = res.body.find((e: any) => e.champion_name === 'Storm');
          const stormChampionId = stormEntry.champion_id;

          // End current war
          cy.request({
            method: 'POST',
            url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/end`,
            headers: { Authorization: `Bearer ${ownerData.access_token}` },
            body: {},
          });

          // Create new war banning Storm
          cy.request({
            method: 'POST',
            url: `${BACKEND}/alliances/${allianceId}/wars`,
            headers: { Authorization: `Bearer ${ownerData.access_token}` },
            body: { opponent_name: 'Ban Storm War', banned_champion_ids: [stormChampionId] },
          }).then((warRes) => {
            const newWarId = warRes.body.id;

            cy.request({
              method: 'GET',
              url: availableUrl(newWarId),
              headers: { Authorization: `Bearer ${memberData.access_token}` },
            }).then((availableRes) => {
              const names = availableRes.body.map((e: any) => e.champion_name);
              expect(names).not.to.include('Storm');
            });
          });
        });
      }
    );
  });

  it('prefight entry row visible for prefight provider in attackers panel', () => {
    setupPrefightScenario('pf7').then(
      ({ memberData, allianceId, warId, championUserId, prefightChampionUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiAddWarPrefight(memberData.access_token, allianceId, warId, 1, prefightChampionUserId, 10);

        cy.apiLogin(memberData.user_id);
        cy.visit('/game/war');
        cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
        cy.getByCy('prefight-entry-node-10').should('be.visible');
      }
    );
  });
});
