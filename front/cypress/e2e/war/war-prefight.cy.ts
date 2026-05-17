import { BACKEND, setupAttackerScenario, setupPrefightScenario } from '../../support/e2e';

function loadAndAddToRoster(
  adminToken: string,
  token: string,
  accId: string,
  name: string,
  cls: string,
  cb: (args: { champId: string; cu: { id: string } }) => void,
) {
  cy.apiLoadChampion(adminToken, name, cls).then((champs: { id: string }[]) => {
    cy.apiAddChampionToRoster(token, accId, champs[0].id, '7r3').then((cu: { id: string }) => {
      cb({ champId: champs[0].id, cu });
    });
  });
}

function getAvailableAfterBan(
  ownerToken: string,
  memberToken: string,
  allianceId: string,
  warId: string,
  bannedChampionId: string,
  cb: (names: string[]) => void,
) {
  cy.apiEndWar(ownerToken, allianceId, warId, true, 10);
  cy.request({
    method: 'POST',
    url: `${BACKEND}/alliances/${allianceId}/wars`,
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: { opponent_name: 'Ban Storm War', banned_champion_ids: [bannedChampionId] },
  }).then((warRes: { body: { id: string } }) => {
    cy.request({
      method: 'GET',
      url: `${BACKEND}/alliances/${allianceId}/wars/${warRes.body.id}/bg/1/available-prefight-attackers`,
      headers: { Authorization: `Bearer ${memberToken}` },
    }).then((res: { body: { champion_name: string }[] }) => {
      cb(res.body.map((e) => e.champion_name));
    });
  });
}

describe('War Prefight', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('adds a pre-fight champion via the popover and shows the badge', () => {
    setupPrefightScenario('pf1').then(({ memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      cy.apiLogin(memberData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');

      cy.getByCy('prefight-trigger-node-10').click();
      cy.getByCy('prefight-add-node-10').click();

      cy.getByCy('prefight-selector').should('be.visible');
      cy.getByCy('prefight-pick-Storm').click();
      cy.getByCy('prefight-selector').should('not.exist');

      // Re-open the popover to confirm Storm was assigned (revoke button visible)
      cy.getByCy('prefight-trigger-node-10').click();
      cy.getByCy('prefight-revoke-Storm').should('exist');
    });
  });

  it('revokes a pre-fight champion via the popover', () => {
    setupPrefightScenario('pf2').then(({ memberData, allianceId, warId, championUserId, prefightChampionUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiAddWarPrefight(memberData.access_token, allianceId, warId, 1, prefightChampionUserId, 10);

      cy.apiLogin(memberData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');

      cy.getByCy('prefight-trigger-node-10').click();
      cy.getByCy('prefight-revoke-Storm').click();

      cy.getByCy('prefight-trigger-node-10').find('[title]').should('not.exist');
    });
  });

  it('returns 422 when no attacker is assigned on the node', () => {
    setupAttackerScenario('pf3').then(({ adminToken, memberData, memberAccId, allianceId, warId }) => {
      const prefightUrl = `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/prefight`;
      loadAndAddToRoster(adminToken, memberData.access_token, memberAccId, 'Storm', 'Mutant', ({ cu: stormCu }) => {
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
  });

  it('returns 409 on duplicate pre-fight assignment', () => {
    setupPrefightScenario('pf4').then(({ memberData, allianceId, warId, championUserId, prefightChampionUserId }) => {
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
    });
  });

  it('API — same champion can prefight two different nodes', () => {
    setupPrefightScenario('pf5').then(
      ({
        adminToken,
        ownerData,
        memberData,
        allianceId,
        warId,
        championUserId,
        memberAccId,
        prefightChampionUserId,
      }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        loadAndAddToRoster(
          adminToken,
          memberData.access_token,
          memberAccId,
          'Captain Marvel',
          'Cosmic',
          ({ champId, cu }) => {
            cy.apiPlaceWarDefender(ownerData.access_token, allianceId, warId, 1, 11, champId, 7, 3, 0);
            cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 11, cu.id);

            const prefightUrl = `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/prefight`;

            cy.request({
              method: 'POST',
              url: prefightUrl,
              headers: { Authorization: `Bearer ${memberData.access_token}` },
              body: { champion_user_id: prefightChampionUserId, target_node_number: 10 },
            }).then((res) => expect(res.status).to.eq(201));

            cy.request({
              method: 'POST',
              url: prefightUrl,
              headers: { Authorization: `Bearer ${memberData.access_token}` },
              body: { champion_user_id: prefightChampionUserId, target_node_number: 11 },
            }).then((res2) => expect(res2.status).to.eq(201));
          },
        );
      },
    );
  });

  it('API — champion without has_prefight is rejected (422)', () => {
    setupAttackerScenario('pf6').then(({ adminToken, memberData, allianceId, warId, championUserId, memberAccId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      loadAndAddToRoster(adminToken, memberData.access_token, memberAccId, 'Iron Man', 'Tech', ({ cu: ironManCu }) => {
        cy.request({
          method: 'POST',
          url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/prefight`,
          headers: { Authorization: `Bearer ${memberData.access_token}` },
          body: { champion_user_id: ironManCu.id, target_node_number: 10 },
          failOnStatusCode: false,
        }).then((res) => expect(res.status).to.eq(422));
      });
    });
  });

  it('API — banned champion is excluded from available-prefight-attackers', () => {
    setupPrefightScenario('pf8').then(({ ownerData, memberData, allianceId, warId }) => {
      cy.request({
        method: 'GET',
        url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/available-prefight-attackers`,
        headers: { Authorization: `Bearer ${memberData.access_token}` },
      }).then((res) => {
        const stormChampionId = res.body.find(
          (e: { champion_name: string; champion_id: string }) => e.champion_name === 'Storm',
        ).champion_id;
        getAvailableAfterBan(
          ownerData.access_token,
          memberData.access_token,
          allianceId,
          warId,
          stormChampionId,
          (names) => {
            expect(names).not.to.include('Storm');
          },
        );
      });
    });
  });

  it('preferred attacker shows badge in prefight selector', () => {
    setupAttackerScenario('pf-pref-sel').then(
      ({ adminToken, memberData, memberAccId, allianceId, warId, championUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        cy.apiLoadChampion(adminToken, 'Storm', 'Mutant').then((champs) => {
          const stormId = champs[0].id;

          cy.request({
            method: 'PATCH',
            url: `${BACKEND}/admin/champions/${stormId}/prefight`,
            headers: { Authorization: `Bearer ${adminToken}` },
          });

          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, stormId, '7r3', {
            is_preferred_attacker: true,
          });

          cy.apiLogin(memberData.user_id);
          cy.visit('/game/war');
          cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');

          cy.getByCy('prefight-trigger-node-10').click();
          cy.getByCy('prefight-add-node-10').click();
          cy.getByCy('prefight-selector').should('be.visible');

          cy.getByCy('prefight-pick-Storm').find('[data-cy="preferred-badge"]').should('exist');
        });
      },
    );
  });

  it('prefight entry row visible for prefight provider in attackers panel', () => {
    setupPrefightScenario('pf7').then(({ memberData, allianceId, warId, championUserId, prefightChampionUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiAddWarPrefight(memberData.access_token, allianceId, warId, 1, prefightChampionUserId, 10);

      cy.apiLogin(memberData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('prefight-entry-node-10').should('be.visible');
    });
  });
});
