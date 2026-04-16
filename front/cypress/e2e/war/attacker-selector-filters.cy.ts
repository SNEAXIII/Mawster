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
      cy.apiLoadChampion(adminToken, 'Storm', 'Mutant', { is_saga_attacker: true }).then((champs) => {
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

      // Both attackers visible initially
      cy.getByCy('attacker-card-Storm').should('be.visible');
      cy.getByCy('attacker-card-Wolverine').should('be.visible');

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
      cy.getByCy('attacker-card-Storm').should('be.visible');
      cy.getByCy('attacker-card-Wolverine').should('be.visible');
      cy.getByCy('selector-reset-filters').should('not.exist');
    });
  });

  // =========================================================================
  // Reset button
  // =========================================================================

  it('reset button clears all active filters and restores all attackers', () => {
    setupAttackerScenario('atk-flt-reset').then(({ adminToken, ownerData, memberData, memberAccId }) => {
      cy.apiLoadChampion(adminToken, 'Storm', 'Mutant', { is_saga_attacker: true }).then((champs) => {
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
      cy.apiLoadChampion(adminToken, 'Storm', 'Mutant', { is_saga_attacker: true }).then((champs) => {
        cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3', {
          is_preferred_attacker: true,
        });
      });
      cy.apiLoadChampion(adminToken, 'Deadpool', 'Mutant', { is_saga_attacker: true }).then((champs) => {
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
