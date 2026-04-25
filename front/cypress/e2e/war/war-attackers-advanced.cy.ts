import { setupAttackerScenario, setupPrefightScenario, BACKEND } from '../../support/e2e';

function goToAttackersMode(userId: string) {
  cy.apiLogin(userId);
  cy.navTo('war');
  cy.getByCy('war-mode-attackers').click();
}

describe('War – Attackers mode (advanced)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── 3-attacker limit ──────────────────────────────────────────────────────

  it('assigning a 4th attacker is rejected', () => {
    setupAttackerScenario('atk-limit').then(({ adminToken, memberData, memberAccId, ownerData, allianceId, warId }) => {
      cy.apiLoadChampions(adminToken, [
        { name: 'Thor', cls: 'Cosmic' },
        { name: 'Captain Marvel', cls: 'Cosmic' },
        { name: 'Doctor Strange', cls: 'Mystic' },
        { name: 'Vision', cls: 'Tech' },
      ]).then((champMap) => {
        [11, 12, 13].forEach((node, i) => {
          const name = ['Thor', 'Captain Marvel', 'Doctor Strange'][i];
          cy.apiPlaceWarDefender(ownerData.access_token, allianceId, warId, 1, node, champMap[name].id, 7, 3, 0);
        });

        const attackerNames = ['Thor', 'Captain Marvel', 'Doctor Strange', 'Vision'];
        const cuIds: string[] = [];
        attackerNames.forEach((name) => {
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champMap[name].id, '7r3').then((cu: any) => {
            cuIds.push(cu.id);
          });
        });

        cy.then(() => {
          [10, 11, 12].forEach((node, i) => {
            cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, node, cuIds[i]);
          });
        });

        cy.then(() => {
          cy.request({
            method: 'POST',
            url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/node/13/attacker`,
            headers: { Authorization: `Bearer ${memberData.access_token}` },
            body: { champion_user_id: cuIds[3] },
            failOnStatusCode: false,
          }).then((res) => {
            expect(res.status).to.eq(409);
          });
        });
      });
    });
  });

  it('replacing attacker on occupied node via UI does not count as extra (regression)', () => {
    setupAttackerScenario('atk-replace').then(
      ({ adminToken, memberData, memberAccId, ownerData, allianceId, warId }) => {
        cy.apiLoadChampions(adminToken, [
          { name: 'Thor', cls: 'Cosmic' },
          { name: 'Captain Marvel', cls: 'Cosmic' },
          { name: 'Doctor Strange', cls: 'Mystic' },
          { name: 'Vision', cls: 'Tech' },
        ]).then((champMap) => {
          [11, 12, 13].forEach((node, i) => {
            const name = ['Thor', 'Captain Marvel', 'Doctor Strange'][i];
            cy.apiPlaceWarDefender(ownerData.access_token, allianceId, warId, 1, node, champMap[name].id, 7, 3, 0);
          });

          const attackerNames = ['Thor', 'Captain Marvel', 'Doctor Strange', 'Vision'];
          const cuIds: string[] = [];
          attackerNames.forEach((name) => {
            cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champMap[name].id, '7r3').then(
              (cu: any) => {
                cuIds.push(cu.id);
              },
            );
          });

          cy.then(() => {
            [10, 11, 12].forEach((node, i) => {
              cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, node, cuIds[i]);
            });
          });

          cy.then(() => {
            cy.apiLogin(memberData.user_id);
            cy.navTo('war');
            cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
            cy.getByCy('war-attacker-search').should('be.visible');
            cy.getByCy('attacker-card-Vision').should('be.visible').click();
            cy.getByCy('attacker-entry-node-10').scrollIntoView().should('be.visible');
            cy.getByCy('attacker-entry-node-10').should('have.attr', 'data-attacker', 'Vision');
          });
        });
      },
    );
  });

  // ── Removing attacker cascades to prefight ───────────────────────────────

  it('removing an attacker also removes its prefight assignment', () => {
    setupPrefightScenario('atk-prefight-cascade').then(
      ({ ownerData, memberData, allianceId, warId, championUserId, prefightChampionUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiAddWarPrefight(memberData.access_token, allianceId, warId, 1, prefightChampionUserId, 10);

        cy.request({
          method: 'GET',
          url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/prefight`,
          headers: { Authorization: `Bearer ${memberData.access_token}` },
        }).then((res) => expect(res.body).to.have.length(1));

        goToAttackersMode(ownerData.user_id);
        cy.getByCy('remove-attacker-node-10').click();
        cy.getByCy('confirmation-dialog-confirm').click();
        cy.request({
          method: 'GET',
          url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/prefight`,
          headers: { Authorization: `Bearer ${memberData.access_token}` },
        }).then((res) => expect(res.body).to.have.length(0));
      },
    );
  });

  // ── Preferred attacker badge ──────────────────────────────────────────────

  it('preferred attacker shows badge in attacker selector', () => {
    setupAttackerScenario('atk-pref-selector').then(({ adminToken, memberData, memberAccId, ownerData }) => {
      cy.apiLoadChampion(adminToken, 'Deadpool', 'Mutant').then((champs) => {
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3', {
          is_preferred_attacker: true,
        }).then(() => {
          goToAttackersMode(ownerData.user_id);
          cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
          cy.getByCy('war-attacker-search').should('be.visible');
          cy.getByCy('attacker-card-Deadpool').find('[data-cy="preferred-badge"]').should('exist');
          cy.getByCy('attacker-card-Wolverine').find('[data-cy="preferred-badge"]').should('not.exist');
        });
      });
    });
  });

  it('preferred attacker badge shows in panel after assigning', () => {
    setupAttackerScenario('atk-pref-panel').then(
      ({ adminToken, memberData, memberAccId, ownerData, allianceId, warId }) => {
        cy.apiLoadChampion(adminToken, 'Deadpool', 'Mutant').then((champs) => {
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3', {
            is_preferred_attacker: true,
          }).then((cu) => {
            cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, cu.id);
            goToAttackersMode(ownerData.user_id);
            cy.getByCy('attacker-entry-node-10').scrollIntoView().should('be.visible');
            cy.getByCy('attacker-entry-node-10').find('[data-cy="preferred-badge"]').should('exist');
          });
        });
      },
    );
  });
});
