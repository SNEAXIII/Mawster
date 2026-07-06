import { setupDefenseOwner, setupDefenseOwnerAndMember } from '../../support/e2e';

describe('Defense – AllianceDefenseSelector filters', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Class filter
  // =========================================================================

  it('class filter shows only champions of the selected class', () => {
    setupDefenseOwner('def-flt-cls', 'ClsFilterPlyr', 'ClassAll', 'CF').then(({ adminData, ownerData, ownerAccId }) => {
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
    });
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
    setupDefenseOwner('def-flt-saga', 'SagaFltPlyr', 'SagaAll', 'SF').then(({ adminData, ownerData, ownerAccId }) => {
      cy.apiLoadChampionWithSaga(adminData.access_token, 'Spider-Man', 'Cosmic', { is_saga_defender: true }).then(
        (champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        },
      );
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
    });
  });

  // =========================================================================
  // Not Preferred toggle
  // =========================================================================

  it('not preferred toggle hides champion only when all its owners are preferred attackers', () => {
    setupDefenseOwnerAndMember('def-flt-npref-multi', 'NPrefMultiOwn', 'NPrefMultiMem', 'NPrefMultiAll', 'NM').then(
      ({ adminData, ownerData, memberData, ownerAccId, memberAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) => {
          // owner: preferred, member: not preferred → champion stays visible (at least one non-preferred owner)
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3', {
            is_preferred_attacker: true,
          });
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3', {
            is_preferred_attacker: false,
          });
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Spider-Man').should('be.visible');

        cy.getByCy('selector-toggle-notPreferred').click();

        cy.getByCy('champion-card-Spider-Man').should('be.visible');
      },
    );
  });

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
        cy.apiLoadChampionWithSaga(adminData.access_token, 'Spider-Man', 'Cosmic', { is_saga_defender: true }).then(
          (champs) => {
            cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
          },
        );
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
  // Defense map player filter (member panel + node dimming)
  // =========================================================================

  it('defense-player-filter hides other member cards and dims their nodes on the map', () => {
    setupDefenseOwnerAndMember('def-mpflt', 'MPFltOwner', 'MPFltMember', 'MPFltAll', 'MPF').then(
      ({ adminData, ownerData, memberData, allianceId, ownerAccId, memberAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3').then((cu) => {
            cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId);
          });
        });
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) => {
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3').then((cu) => {
            cy.apiPlaceDefender(memberData.access_token, allianceId, 1, 2, cu.id, memberAccId);
          });
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('member-section-MPFltOwner').should('be.visible');
        cy.getByCy('member-section-MPFltMember').should('be.visible');

        cy.getByCy('defense-player-filter').click();
        cy.contains('[role="option"]', 'MPFltOwner').click();

        cy.getByCy('member-section-MPFltOwner').should('be.visible');
        cy.getByCy('member-section-MPFltMember').should('not.exist');

        cy.getByCy('war-node-1').should('not.have.class', 'opacity-25');
        cy.getByCy('war-node-2').should('have.class', 'opacity-25');
      },
    );
  });

  it('defense-player-filter restores all members when reset to All', () => {
    setupDefenseOwnerAndMember('def-mpflt-r', 'MPFROwner', 'MPFRMember', 'MPFRAll', 'MFR').then(
      ({ adminData, ownerData, memberData, allianceId, ownerAccId, memberAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3').then((cu) => {
            cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId);
          });
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('defense-player-filter').click();
        cy.contains('[role="option"]', 'MPFROwner').click();
        cy.getByCy('member-section-MPFRMember').should('not.exist');

        cy.getByCy('defense-player-filter').click();
        cy.contains('[role="option"]', 'All').click();

        cy.getByCy('member-section-MPFROwner').should('be.visible');
        cy.getByCy('member-section-MPFRMember').should('be.visible');
      },
    );
  });

  // =========================================================================
  // Filters combine
  // =========================================================================

  it('class and saga filters combine to narrow results', () => {
    setupDefenseOwner('def-flt-comb', 'CombFltPlyr', 'CombAll', 'CB').then(({ adminData, ownerData, ownerAccId }) => {
      cy.apiLoadChampionWithSaga(adminData.access_token, 'Spider-Man', 'Cosmic', { is_saga_defender: true }).then(
        (champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        },
      );
      cy.apiLoadChampionWithSaga(adminData.access_token, 'Iron Man', 'Tech', { is_saga_defender: true }).then(
        (champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        },
      );
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
    });
  });
});

describe('Defense – AllianceDefenseSelector rarity filter', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // 6★ champions are hidden and no longer offer a reveal toggle (7★ only)
  // =========================================================================

  it('hides 6-star champions and offers no toggle to reveal them', () => {
    setupDefenseOwner('def-rar-def', 'RarDefPlyr', 'RarDefAll', 'RD').then(({ adminData, ownerData, ownerAccId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) => {
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
      });
      cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) => {
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '6r5');
      });

      cy.apiLogin(ownerData.user_id);
      cy.navTo('defense');

      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });

      // 7★ Spider-Man visible, 6★ Wolverine hidden
      cy.getByCy('champion-card-Spider-Man').should('be.visible');
      cy.getByCy('champion-card-Wolverine').should('not.exist');

      // The rarity filter only exposes 7★ tiers — no 6★ toggle exists, so the
      // 6★ champion cannot be revealed.
      cy.getByCy('defense-rarity-6r4').should('not.exist');
      cy.getByCy('defense-rarity-6r5').should('not.exist');
      cy.getByCy('defense-rarity-7r3').should('be.visible');
      cy.getByCy('champion-card-Wolverine').should('not.exist');
    });
  });

  // =========================================================================
  // Toggling a 7★ tier off hides that tier
  // =========================================================================

  it('deactivating a 7-star tier hides champions of that exact tier', () => {
    setupDefenseOwner('def-rar-tier', 'RarTierPlyr', 'RarTierAll', 'RT').then(
      ({ adminData, ownerData, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5');
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Spider-Man').should('be.visible');
        cy.getByCy('champion-card-Wolverine').should('be.visible');

        // Turn 7r3 off → Spider-Man (7r3) hidden, Wolverine (7r5) stays
        cy.getByCy('defense-rarity-7r3').click();
        cy.getByCy('champion-card-Spider-Man').should('not.exist');
        cy.getByCy('champion-card-Wolverine').should('be.visible');
      },
    );
  });

  // =========================================================================
  // Persistence + independence from Reset
  // =========================================================================

  it('persists the rarity preference across reopen and is untouched by Reset', () => {
    setupDefenseOwner('def-rar-persist', 'RarPersPlyr', 'RarPersAll', 'RP').then(
      ({ adminData, ownerData, ownerAccId }) => {
        // Spider-Man 7r3 and Wolverine 7r5 (saga defender)
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });
        cy.apiLoadChampionWithSaga(adminData.access_token, 'Wolverine', 'Mutant', { is_saga_defender: true }).then(
          (champs) => {
            cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5');
          },
        );

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });

        // Turn 7r3 off → Spider-Man (7r3) hidden, Wolverine (7r5) stays
        cy.getByCy('defense-rarity-7r3').click();
        cy.getByCy('champion-card-Spider-Man').should('not.exist');
        cy.getByCy('champion-card-Wolverine').should('be.visible');

        // Activate then Reset a normal filter — rarity must survive
        cy.getByCy('selector-toggle-saga').click();
        cy.getByCy('selector-reset-filters').click();
        cy.getByCy('champion-card-Spider-Man').should('not.exist');
        cy.getByCy('champion-card-Wolverine').should('be.visible');

        // Close and reopen the dialog — preference persisted via localStorage
        cy.get('body').type('{esc}');
        cy.getByCy('champion-card-Wolverine').should('not.exist');
        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Spider-Man').should('not.exist');
        cy.getByCy('champion-card-Wolverine').should('be.visible');
      },
    );
  });

  // =========================================================================
  // Sorting: preferred first, then rank descending
  // =========================================================================

  it('orders champions preferred-first then by descending rank', () => {
    setupDefenseOwner('def-rar-sort', 'RarSortPlyr', 'RarSortAll', 'RS').then(
      ({ adminData, ownerData, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5');
        });
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });
        cy.apiLoadChampion(adminData.access_token, 'Iron Man', 'Tech').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r1', {
            is_preferred_attacker: true,
          });
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });

        // Expected order: Iron Man (preferred) → Spider-Man (7r5) → Wolverine (7r3)
        cy.get('[data-cy^="champion-card-"]').then(($cards) => {
          const order = [...$cards].map((el) => el.getAttribute('data-cy'));
          expect(order).to.deep.equal([
            'champion-card-Iron-Man',
            'champion-card-Spider-Man',
            'champion-card-Wolverine',
          ]);
        });
      },
    );
  });
});
