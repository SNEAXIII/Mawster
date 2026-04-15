import { setupDefenseOwner, setupDefenseOwnerAndMember } from '../../support/e2e';

describe('Defense – AllianceDefenseSelector filters', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Class filter
  // =========================================================================

  it('class filter shows only champions of the selected class', () => {
    setupDefenseOwner('def-flt-cls', 'ClsFilterPlyr', 'ClassAll', 'CF').then(
      ({ adminData, ownerData, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Spider-Man').should('be.visible');
        cy.getByCy('champion-card-Wolverine').should('be.visible');

        cy.getByCy('selector-class-filter').click();
        cy.contains('[role="option"]', 'Cosmic').click();

        cy.getByCy('champion-card-Spider-Man').should('be.visible');
        cy.getByCy('champion-card-Wolverine').should('not.exist');
      },
    );
  });

  // =========================================================================
  // Player filter
  // =========================================================================

  it('player filter shows only champions owned by the selected player', () => {
    setupDefenseOwnerAndMember('def-flt-plyr', 'PlyrFltOwn', 'PlyrFltMem', 'PlyrAll', 'PF').then(
      ({ adminData, ownerData, memberData, ownerAccId, memberAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) => {
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3');
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Spider-Man').should('be.visible');
        cy.getByCy('champion-card-Wolverine').should('be.visible');

        cy.getByCy('selector-player-filter').click();
        cy.contains('[role="option"]', 'PlyrFltOwn').click();

        cy.getByCy('champion-card-Spider-Man').should('be.visible');
        cy.getByCy('champion-card-Wolverine').should('not.exist');
      },
    );
  });

  // =========================================================================
  // Saga Defender toggle
  // =========================================================================

  it('saga defender toggle shows only saga defenders', () => {
    setupDefenseOwner('def-flt-saga', 'SagaFltPlyr', 'SagaAll', 'SF').then(
      ({ adminData, ownerData, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic', { is_saga_defender: true }).then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Spider-Man').should('be.visible');
        cy.getByCy('champion-card-Wolverine').should('be.visible');

        cy.getByCy('selector-toggle-saga').click();

        cy.getByCy('champion-card-Spider-Man').should('be.visible');
        cy.getByCy('champion-card-Wolverine').should('not.exist');
      },
    );
  });

  // =========================================================================
  // Not Preferred toggle
  // =========================================================================

  it('not preferred toggle shows only champions whose owners are not preferred attackers', () => {
    setupDefenseOwner('def-flt-npref', 'NPrefFltPlyr', 'NPrefAll', 'NP').then(
      ({ adminData, ownerData, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3', {
            is_preferred_attacker: false,
          });
        });
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3', {
            is_preferred_attacker: true,
          });
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Spider-Man').should('be.visible');
        cy.getByCy('champion-card-Wolverine').should('be.visible');

        cy.getByCy('selector-toggle-notPreferred').click();

        cy.getByCy('champion-card-Spider-Man').should('be.visible');
        cy.getByCy('champion-card-Wolverine').should('not.exist');
      },
    );
  });

  // =========================================================================
  // Reset button
  // =========================================================================

  it('reset button clears all active filters and restores all champions', () => {
    setupDefenseOwner('def-flt-reset', 'ResetFltPlyr', 'ResetAll', 'RF').then(
      ({ adminData, ownerData, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic', { is_saga_defender: true }).then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });

        // Activate saga filter → only Spider-Man visible
        cy.getByCy('selector-toggle-saga').click();
        cy.getByCy('champion-card-Wolverine').should('not.exist');

        // Reset button appears and restores all champions
        cy.getByCy('selector-reset-filters').should('be.visible').click();
        cy.getByCy('champion-card-Spider-Man').should('be.visible');
        cy.getByCy('champion-card-Wolverine').should('be.visible');
        cy.getByCy('selector-reset-filters').should('not.exist');
      },
    );
  });

  // =========================================================================
  // Filters combine
  // =========================================================================

  it('class and saga filters combine to narrow results', () => {
    setupDefenseOwner('def-flt-comb', 'CombFltPlyr', 'CombAll', 'CB').then(
      ({ adminData, ownerData, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic', { is_saga_defender: true }).then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });
        cy.apiLoadChampion(adminData.access_token, 'Iron Man', 'Tech', { is_saga_defender: true }).then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });

        // Saga filter → Spider-Man + Iron Man visible
        cy.getByCy('selector-toggle-saga').click();
        cy.getByCy('champion-card-Spider-Man').should('be.visible');
        cy.getByCy('champion-card-Iron-Man').should('be.visible');
        cy.getByCy('champion-card-Wolverine').should('not.exist');

        // Add class filter Cosmic → only Spider-Man
        cy.getByCy('selector-class-filter').click();
        cy.contains('[role="option"]', 'Cosmic').click();
        cy.getByCy('champion-card-Spider-Man').should('be.visible');
        cy.getByCy('champion-card-Iron-Man').should('not.exist');
      },
    );
  });
});
