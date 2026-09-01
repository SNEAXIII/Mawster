import { setupAttackerScenario, setupPrefightScenario, confirmAction, openWarNode } from '../../support/e2e';

function goToAttackersMode(userId: string) {
  cy.apiLogin(userId, 'war');
  cy.getByCy('war-mode-attackers').click();
}

const FOUR_CHAMPS = [
  { name: 'Thor', cls: 'Cosmic' },
  { name: 'Captain Marvel', cls: 'Cosmic' },
  { name: 'Doctor Strange', cls: 'Mystic' },
  { name: 'Vision', cls: 'Tech' },
];

type AttackerSetup = {
  adminToken: string;
  memberData: { access_token: string; user_id: string };
  memberAccId: string;
  ownerData: { access_token: string };
  allianceId: string;
  warId: string;
};

/**
 * Defenders on nodes 11-13, all four champions on the member's roster, and the
 * first three assigned as attackers on nodes 10-12 — the member is at the limit.
 * Yields the four champion-user ids in FOUR_CHAMPS order.
 */
function seedAttackersAtLimit(s: AttackerSetup, then: (cuIds: string[]) => void) {
  cy.apiLoadChampions(s.adminToken, FOUR_CHAMPS).then((champMap) => {
    [11, 12, 13].forEach((node, i) => {
      const { name } = FOUR_CHAMPS[i];
      cy.apiPlaceWarDefender(s.ownerData.access_token, s.allianceId, s.warId, 1, node, champMap[name].id, 7, 3, 0);
    });

    const cuIds: string[] = [];
    FOUR_CHAMPS.forEach(({ name }) => {
      cy.apiAddChampionToRoster(s.memberData.access_token, s.memberAccId, champMap[name].id, '7r3').then((cu: any) => {
        cuIds.push(cu.id);
      });
    });

    cy.then(() => {
      [10, 11, 12].forEach((node, i) => {
        cy.apiAssignWarAttacker(s.memberData.access_token, s.allianceId, s.warId, 1, node, cuIds[i]);
      });
    });

    cy.then(() => then(cuIds));
  });
}

describe('War – Attackers mode (advanced)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── 3-attacker limit ──────────────────────────────────────────────────────

  it('assigning a 4th attacker is rejected', () => {
    setupAttackerScenario('atk-limit').then((s) => {
      seedAttackersAtLimit(s, (cuIds) => {
        cy.apiRequest(
          s.memberData.access_token,
          'POST',
          `/alliances/${s.allianceId}/wars/${s.warId}/bg/1/node/13/attacker`,
          { champion_user_id: cuIds[3] },
          { failOnStatusCode: false },
        ).then((res) => {
          expect(res.status).to.eq(409);
        });
      });
    });
  });

  it('replacing attacker on occupied node via UI does not count as extra (regression)', () => {
    setupAttackerScenario('atk-replace').then((s) => {
      seedAttackersAtLimit(s, () => {
        cy.apiLogin(s.memberData.user_id, 'war');
        openWarNode(10);
        cy.getByCy('war-attacker-search').should('be.visible');
        cy.getByCy('attacker-card-Vision').should('be.visible').click();
        cy.getByCy('attacker-entry-node-10').scrollIntoView().should('be.visible');
        cy.getByCy('attacker-entry-node-10').should('have.attr', 'data-attacker', 'Vision');
      });
    });
  });

  // ── Removing attacker cascades to prefight ───────────────────────────────

  it('removing an attacker also removes its prefight assignment', () => {
    setupPrefightScenario('atk-prefight-cascade').then(
      ({ ownerData, memberData, allianceId, warId, championUserId, prefightChampionUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
        cy.apiAddWarPrefight(memberData.access_token, allianceId, warId, 1, prefightChampionUserId, 10);

        cy.apiRequest(memberData.access_token, 'GET', `/alliances/${allianceId}/wars/${warId}/bg/1/prefight`).then(
          (res) => expect(res.body).to.have.length(1),
        );

        goToAttackersMode(ownerData.user_id);
        confirmAction('remove-attacker-node-10');
        cy.apiRequest(memberData.access_token, 'GET', `/alliances/${allianceId}/wars/${warId}/bg/1/prefight`).then(
          (res) => expect(res.body).to.have.length(0),
        );
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
          openWarNode(10);
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
