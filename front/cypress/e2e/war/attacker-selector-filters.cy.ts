import { setupAttackerScenario } from '../../support/e2e';

function goToAttackersMode(userId: string) {
  cy.apiLogin(userId);
  cy.navTo('war');
  cy.getByCy('war-mode-attackers').click();
}

describe('War – WarAttackerSelector filters', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Class filter
  // =========================================================================

  it('class filter shows only attackers of the selected class', () => {
    setupAttackerScenario('atk-flt-cls').then(({ adminToken, ownerData, memberData, memberAccId }) => {
      // Add a Tech champion to the member roster alongside existing Wolverine (Mutant)
      cy.apiLoadChampion(adminToken, 'Vision', 'Tech').then((champs) => {
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3');
      });

      goToAttackersMode(ownerData.user_id);
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');

      // Both attackers visible initially
      cy.getByCy('attacker-card-Wolverine').should('be.visible');
      cy.getByCy('attacker-card-Vision').should('be.visible');

      // Filter by Tech → only Vision
      cy.getByCy('selector-class-filter').click();
      cy.contains('[role="option"]', 'Tech').click();
      cy.getByCy('attacker-card-Vision').should('be.visible');
      cy.getByCy('attacker-card-Wolverine').should('not.exist');

      // Filter by Mutant → only Wolverine
      cy.getByCy('selector-class-filter').click();
      cy.contains('[role="option"]', 'Mutant').click();
      cy.getByCy('attacker-card-Wolverine').should('be.visible');
      cy.getByCy('attacker-card-Vision').should('not.exist');
    });
  });

  // =========================================================================
  // Saga Attacker toggle
  // =========================================================================

  it('saga attacker toggle shows only saga attackers', () => {
    setupAttackerScenario('atk-flt-saga').then(({ adminToken, ownerData, memberData, memberAccId }) => {
      cy.apiLoadChampionWithSaga(adminToken, 'Storm', 'Mutant', { is_saga_attacker: true }).then((champs) => {
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3');
      });

      goToAttackersMode(ownerData.user_id);
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');

      // Both visible initially (Wolverine = non-saga, Storm = saga)
      cy.getByCy('attacker-card-Wolverine').should('be.visible');
      cy.getByCy('attacker-card-Storm').should('be.visible');

      cy.getByCy('selector-toggle-saga').click();

      cy.getByCy('attacker-card-Storm').should('be.visible');
      cy.getByCy('attacker-card-Wolverine').should('not.exist');
    });
  });

  // =========================================================================
  // Preferred Attacker toggle
  // =========================================================================

  it('preferred attacker toggle shows only preferred attackers', () => {
    setupAttackerScenario('atk-flt-pref').then(({ adminToken, ownerData, memberData, memberAccId }) => {
      cy.apiLoadChampion(adminToken, 'Storm', 'Mutant').then((champs) => {
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3', {
          is_preferred_attacker: true,
        });
      });

      goToAttackersMode(ownerData.user_id);
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');

      // Both visible initially
      cy.getByCy('attacker-card-Wolverine').should('be.visible');
      cy.getByCy('attacker-card-Storm').should('be.visible');

      cy.getByCy('selector-toggle-preferred').click();

      // Only Storm (preferred) visible
      cy.getByCy('attacker-card-Storm').should('be.visible');
      cy.getByCy('attacker-card-Wolverine').should('not.exist');
    });
  });

  // =========================================================================
  // Player filter
  // =========================================================================

  it('player filter shows only the selected player attackers', () => {
    const prefix = 'atk';
    const ownerPseudo = `${prefix}Owner`.slice(0, 16);
    const memberPseudo = `${prefix}Member`.slice(0, 16);

    setupAttackerScenario(prefix).then(({ adminToken, ownerData, ownerAccId }) => {
      // Owner gets Storm; member already has Wolverine
      cy.apiLoadChampion(adminToken, 'Storm', 'Mutant').then((champs) => {
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
      });

      goToAttackersMode(ownerData.user_id);
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');

      // Both attackers visible initially (two member groups overflow the
      // dialog's scrollable list, so scroll each card into view before asserting)
      cy.getByCy('attacker-card-Storm').scrollIntoView().should('be.visible');
      cy.getByCy('attacker-card-Wolverine').scrollIntoView().should('be.visible');

      // Filter by member → only Wolverine
      cy.getByCy('selector-player-filter').click();
      cy.contains('[role="option"]', memberPseudo).click();
      cy.getByCy('attacker-card-Wolverine').should('be.visible');
      cy.getByCy('attacker-card-Storm').should('not.exist');

      // Switch to owner → only Storm
      cy.getByCy('selector-player-filter').click();
      cy.contains('[role="option"]', ownerPseudo).click();
      cy.getByCy('attacker-card-Storm').should('be.visible');
      cy.getByCy('attacker-card-Wolverine').should('not.exist');
    });
  });

  it('player filter combines with class filter', () => {
    const prefix = 'atk';
    const ownerPseudo = `${prefix}Owner`.slice(0, 16);

    setupAttackerScenario(prefix).then(({ adminToken, ownerData, ownerAccId }) => {
      // Owner gets Storm (Mutant) and Vision (Tech); member already has Wolverine (Mutant)
      cy.apiLoadChampion(adminToken, 'Storm', 'Mutant').then((champs) => {
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
      });
      cy.apiLoadChampion(adminToken, 'Vision', 'Tech').then((champs) => {
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
      });

      goToAttackersMode(ownerData.user_id);
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');

      // Filter by owner + Mutant → only Storm (Vision excluded by class, Wolverine excluded by player)
      cy.getByCy('selector-player-filter').click();
      cy.contains('[role="option"]', ownerPseudo).click();
      cy.getByCy('selector-class-filter').click();
      cy.contains('[role="option"]', 'Mutant').click();

      cy.getByCy('attacker-card-Storm').should('be.visible');
      cy.getByCy('attacker-card-Vision').should('not.exist');
      cy.getByCy('attacker-card-Wolverine').should('not.exist');
    });
  });

  it('reset button clears player filter and restores all players attackers', () => {
    const prefix = 'atk';
    const ownerPseudo = `${prefix}Owner`.slice(0, 16);

    setupAttackerScenario(prefix).then(({ adminToken, ownerData, ownerAccId }) => {
      cy.apiLoadChampion(adminToken, 'Storm', 'Mutant').then((champs) => {
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
      });

      goToAttackersMode(ownerData.user_id);
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');

      cy.getByCy('selector-player-filter').click();
      cy.contains('[role="option"]', ownerPseudo).click();
      cy.getByCy('attacker-card-Wolverine').should('not.exist');

      cy.getByCy('selector-reset-filters').click();
      // Both groups are restored and overflow the list — scroll into view first
      cy.getByCy('attacker-card-Storm').scrollIntoView().should('be.visible');
      cy.getByCy('attacker-card-Wolverine').scrollIntoView().should('be.visible');
      cy.getByCy('selector-reset-filters').should('not.exist');
    });
  });

  // =========================================================================
  // Reset button
  // =========================================================================

  it('reset button clears all active filters and restores all attackers', () => {
    setupAttackerScenario('atk-flt-reset').then(({ adminToken, ownerData, memberData, memberAccId }) => {
      cy.apiLoadChampionWithSaga(adminToken, 'Storm', 'Mutant', { is_saga_attacker: true }).then((champs) => {
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3');
      });

      goToAttackersMode(ownerData.user_id);
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');

      // Activate saga filter → only Storm
      cy.getByCy('selector-toggle-saga').click();
      cy.getByCy('attacker-card-Wolverine').should('not.exist');

      // Reset → all attackers back, reset button disappears
      cy.getByCy('selector-reset-filters').should('be.visible').click();
      cy.getByCy('attacker-card-Wolverine').should('be.visible');
      cy.getByCy('attacker-card-Storm').should('be.visible');
      cy.getByCy('selector-reset-filters').should('not.exist');
    });
  });

  // =========================================================================
  // Filters combine
  // =========================================================================

  it('saga and preferred filters combine to narrow results', () => {
    setupAttackerScenario('atk-flt-comb').then(({ adminToken, ownerData, memberData, memberAccId }) => {
      cy.apiLoadChampionWithSaga(adminToken, 'Storm', 'Mutant', { is_saga_attacker: true }).then((champs) => {
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3', {
          is_preferred_attacker: true,
        });
      });
      cy.apiLoadChampionWithSaga(adminToken, 'Deadpool', 'Mutant', { is_saga_attacker: true }).then((champs) => {
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3', {
          is_preferred_attacker: false,
        });
      });

      goToAttackersMode(ownerData.user_id);
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');

      // Saga filter → Storm + Deadpool (both saga), not Wolverine
      cy.getByCy('selector-toggle-saga').click();
      cy.getByCy('attacker-card-Storm').should('be.visible');
      cy.getByCy('attacker-card-Deadpool').should('be.visible');
      cy.getByCy('attacker-card-Wolverine').should('not.exist');

      // Add preferred filter → only Storm (saga + preferred)
      cy.getByCy('selector-toggle-preferred').click();
      cy.getByCy('attacker-card-Storm').should('be.visible');
      cy.getByCy('attacker-card-Deadpool').should('not.exist');
    });
  });
});

describe('War – WarAttackerSelector rarity filter', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // 6★ attackers are hidden and no longer offer a reveal toggle (7★ only)
  // =========================================================================

  it('hides 6-star attackers and offers no toggle to reveal them', () => {
    setupAttackerScenario('atk-rar-def').then(({ adminToken, memberData, ownerData, memberAccId }) => {
      // Member already has Wolverine 7r3; add a 6r5 champion
      cy.apiLoadChampion(adminToken, 'Storm', 'Mutant').then((champs) => {
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '6r5');
      });

      goToAttackersMode(ownerData.user_id);
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');

      // 7★ Wolverine visible, 6★ Storm hidden
      cy.getByCy('attacker-card-Wolverine').should('be.visible');
      cy.getByCy('attacker-card-Storm').should('not.exist');

      // The rarity filter only exposes 7★ tiers — no 6★ toggle exists, so the
      // 6★ attacker cannot be revealed.
      cy.getByCy('war-attacker-rarity-6r4').should('not.exist');
      cy.getByCy('war-attacker-rarity-6r5').should('not.exist');
      cy.getByCy('war-attacker-rarity-7r3').should('be.visible');
      cy.getByCy('attacker-card-Storm').should('not.exist');
    });
  });

  // =========================================================================
  // Toggling a 7★ tier off hides that tier
  // =========================================================================

  it('deactivating a 7-star tier hides attackers of that exact tier', () => {
    setupAttackerScenario('atk-rar-tier').then(({ adminToken, memberData, ownerData, memberAccId }) => {
      // Member has Wolverine 7r3; add Storm at 7r5
      cy.apiLoadChampion(adminToken, 'Storm', 'Mutant').then((champs) => {
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r5');
      });

      goToAttackersMode(ownerData.user_id);
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');

      // Both 7★ visible by default
      cy.getByCy('attacker-card-Wolverine').should('be.visible');
      cy.getByCy('attacker-card-Storm').should('be.visible');

      // Turn 7r3 off → Wolverine (7r3) hidden, Storm (7r5) stays
      cy.getByCy('war-attacker-rarity-7r3').click();
      cy.getByCy('attacker-card-Wolverine').should('not.exist');
      cy.getByCy('attacker-card-Storm').should('be.visible');
    });
  });

  // =========================================================================
  // Persistence + independence from Reset
  // =========================================================================

  it('persists the rarity preference across reopen and is untouched by Reset', () => {
    setupAttackerScenario('atk-rar-persist').then(({ adminToken, memberData, ownerData, memberAccId }) => {
      // Member has Wolverine 7r3; add Storm at 7r5
      cy.apiLoadChampion(adminToken, 'Storm', 'Mutant').then((champs) => {
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r5');
      });

      goToAttackersMode(ownerData.user_id);
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');

      // Turn 7r3 off → Wolverine (7r3) hidden, Storm (7r5) stays
      cy.getByCy('war-attacker-rarity-7r3').click();
      cy.getByCy('attacker-card-Wolverine').should('not.exist');
      cy.getByCy('attacker-card-Storm').should('be.visible');

      // Activate then Reset a normal filter — rarity must survive
      cy.getByCy('selector-toggle-saga').click();
      cy.getByCy('selector-reset-filters').click();
      cy.getByCy('attacker-card-Wolverine').should('not.exist');
      cy.getByCy('attacker-card-Storm').should('be.visible');

      // Close and reopen the dialog — preference persisted via localStorage
      cy.get('body').type('{esc}');
      cy.getByCy('war-attacker-search').should('not.exist');
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');
      cy.getByCy('attacker-card-Wolverine').should('not.exist');
      cy.getByCy('attacker-card-Storm').should('be.visible');
    });
  });

  // =========================================================================
  // Sorting: preferred first, then rank descending
  // =========================================================================

  it('sorts each member group preferred-first then by descending rank', () => {
    setupAttackerScenario('atk-rar-sort').then(({ adminToken, memberData, ownerData, memberAccId }) => {
      // Member has Wolverine 7r3 (not preferred); add Storm 7r5 (not preferred)
      // and Deadpool 7r1 (preferred).
      cy.apiLoadChampion(adminToken, 'Storm', 'Mutant').then((champs) => {
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r5');
      });
      cy.apiLoadChampion(adminToken, 'Deadpool', 'Mutant').then((champs) => {
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r1', {
          is_preferred_attacker: true,
        });
      });

      goToAttackersMode(ownerData.user_id);
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');

      // Expected order: Deadpool (preferred) → Storm (7r5) → Wolverine (7r3)
      cy.get('[data-cy^="attacker-card-"]').then(($cards) => {
        const order = [...$cards].map((el) => el.getAttribute('data-cy'));
        expect(order).to.deep.equal(['attacker-card-Deadpool', 'attacker-card-Storm', 'attacker-card-Wolverine']);
      });
    });
  });
});
