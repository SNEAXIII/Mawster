import { setupAttackerScenario, setupPrefightScenario, BACKEND } from '../../support/e2e';
function goToAttackersMode(userId: string) {
  cy.apiLogin(userId);
  cy.navTo('war');
  cy.getByCy('war-mode-attackers').click();
}

describe('War – Attackers mode', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Attackers mode is selected by default ─────────────────────────────────

  it('attackers panel is visible by default (Attackers mode)', () => {
    setupAttackerScenario('atk-panel').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('war-mode-attackers').should('have.class', 'bg-primary');
    });
  });

  // ── Assign attacker via API and check sidebar ─────────────────────────────

  it('assigned attacker appears in the attacker panel', () => {
    setupAttackerScenario('atk-sidebar').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);
      cy.getByCy('attacker-entry-node-10').scrollIntoView().should('be.visible');
    });
  });

  // ── KO increment / decrement ──────────────────────────────────────────────

  it('member can increment and decrement KO count', () => {
    setupAttackerScenario('atk-ko').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('ko-value-node-10').should('have.text', '0');
      cy.getByCy('ko-inc-node-10').click();
      cy.getByCy('ko-value-node-10').should('have.text', '1');
      cy.getByCy('ko-inc-node-10').click();
      cy.getByCy('ko-value-node-10').should('have.text', '2');
      cy.getByCy('ko-dec-node-10').click();
      cy.getByCy('ko-value-node-10').should('have.text', '1');
    });
  });

  // ── Remove attacker ───────────────────────────────────────────────────────

  it('member can remove an assigned attacker', () => {
    setupAttackerScenario('atk-remove').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('attacker-entry-node-10').scrollIntoView().should('be.visible');
      cy.getByCy('remove-attacker-node-10').click();
      cy.getByCy('attacker-entry-node-10').should('not.exist');
    });
  });

  it('removing an attacker resets the KO count to 0', () => {
    setupAttackerScenario('atk-ko-reset').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('ko-inc-node-10').click();
      cy.getByCy('ko-value-node-10').should('have.text', '1');
      cy.getByCy('ko-inc-node-10').click();
      cy.getByCy('ko-value-node-10').should('have.text', '2');

      cy.getByCy('remove-attacker-node-10').click();
      cy.getByCy('attacker-entry-node-10').should('not.exist');

      // Re-assign and verify KO is reset
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.reload();
      cy.getByCy('attacker-entry-node-10').scrollIntoView().should('be.visible');
      cy.getByCy('ko-value-node-10').should('have.text', '0');
    });
  });

  // ── Assign via UI (click node in Attackers mode) ──────────────────────────

  it('member can assign attacker by clicking a node in Attackers mode', () => {
    setupAttackerScenario('atk-ui').then(({ ownerData }) => {
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');
      cy.getByCy('attacker-card-Wolverine').should('be.visible').click();
      cy.getByCy('attacker-entry-node-10').scrollIntoView().should('be.visible');
    });
  });

  // ── Node without defender shows warning ──────────────────────────────────

  it('clicking node without defender shows warning toast', () => {
    setupAttackerScenario('atk-warn').then(({ ownerData }) => {
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-node-20').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('not.exist');
    });
  });

  // ── KO and remove buttons hidden when no attacker ────────────────────────

  it('ko buttons and remove button are hidden in selector when no attacker is assigned', () => {
    setupAttackerScenario('atk-no-attacker-btns').then(({ ownerData }) => {
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');
      cy.getByCy('attacker-entry-node-10').should('be.visible');
      cy.getByCy('ko-counter-node-10').should('not.exist');
      cy.getByCy('remove-attacker-node-10').should('not.exist');
    });
  });

  it('ko buttons and remove button appear in panel after assigning an attacker', () => {
    setupAttackerScenario('atk-btns-appear').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('attacker-entry-node-10').scrollIntoView().should('be.visible');
      cy.getByCy('ko-counter-node-10').should('be.visible');
      cy.getByCy('remove-attacker-node-10').should('be.visible');
    });
  });

  // ── x/3 counter visible in panel ─────────────────────────────────────────

  it('attacker panel shows x/3 counter per member', () => {
    setupAttackerScenario('atk-count').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);
      cy.contains('1/3').scrollIntoView().should('be.visible');
    });
  });

  // ── Attacker selector dialog: close without crash ────────────────────────

  it('closing the attacker selector dialog does not crash the page', () => {
    setupAttackerScenario('atk-dialog-close').then(({ ownerData }) => {
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');

      // Close via Escape — regression: used to crash during close animation
      cy.get('body').type('{esc}');
      cy.getByCy('war-attacker-search').should('not.exist');

      // Page should still be functional — reopen the dialog
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');
    });
  });

  it('attacker entry row is visible inside the selector dialog when attacker is assigned', () => {
    setupAttackerScenario('atk-dialog-entry').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');
      cy.getByCy('war-attacker-search').find('[data-cy="attacker-entry-node-10"]').should('be.visible');
    });
  });

  // ── 3-attacker limit ──────────────────────────────────────────────────────

  it('assigning a 4th attacker is rejected', () => {
    setupAttackerScenario('atk-limit').then(({ adminToken, memberData, memberAccId, ownerData, allianceId, warId }) => {
      // Place 3 extra defenders (nodes 11, 12, 13) and load 4 attacker champions
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
        // Add 4 attacker champions to member's roster
        const attackerNames = ['Thor', 'Captain Marvel', 'Doctor Strange', 'Vision'];
        const cuIds: string[] = [];
        attackerNames.forEach((name) => {
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champMap[name].id, '7r3').then((cu: any) => {
            cuIds.push(cu.id);
          });
        });
        // Assign 3 attackers → all succeed
        cy.then(() => {
          [10, 11, 12].forEach((node, i) => {
            cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, node, cuIds[i]);
          });
        });
        // Try 4th → should fail with 409
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
    // Scenario: member already has 3 attackers (nodes 10, 11, 12).
    // Clicking node 10 and selecting a new champion must reassign, not hit the limit.
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
          // Add 4 attacker champions to member's roster
          const attackerNames = ['Thor', 'Captain Marvel', 'Doctor Strange', 'Vision'];
          const cuIds: string[] = [];
          attackerNames.forEach((name) => {
            cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champMap[name].id, '7r3').then(
              (cu: any) => {
                cuIds.push(cu.id);
              },
            );
          });
          // Assign 3 attackers via API
          cy.then(() => {
            [10, 11, 12].forEach((node, i) => {
              cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, node, cuIds[i]);
            });
          });
          // Via UI: click node 10 and reassign to Vision — must succeed (not hit the limit)
          // Members don't have canManageWar so the mode toggle is hidden; they see Attackers view by default
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

        // Verify prefight exists
        cy.request({
          method: 'GET',
          url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/prefight`,
          headers: { Authorization: `Bearer ${memberData.access_token}` },
        }).then((res) => expect(res.body).to.have.length(1));

        // Owner removes the attacker via UI
        goToAttackersMode(ownerData.user_id);
        cy.getByCy('remove-attacker-node-10').click();

        // Prefight must have been cascade-deleted
        cy.request({
          method: 'GET',
          url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/prefight`,
          headers: { Authorization: `Bearer ${memberData.access_token}` },
        }).then((res) => expect(res.body).to.have.length(0));
      }
    );
  });

  // ── Member sees their own assigned attacks ────────────────────────────────

  it('member can see their own assigned attacks in the attacker panel', () => {
    setupAttackerScenario('atk-member-view').then(({ memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      // Log in as the member (not the owner/officer)
      cy.apiLogin(memberData.user_id);
      cy.navTo('war');

      cy.getByCy('attacker-entry-node-10').scrollIntoView().should('be.visible');
    });
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
    setupAttackerScenario('atk-pref-panel').then(({ adminToken, memberData, memberAccId, ownerData, allianceId, warId }) => {
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
    });
  });
});
