import { setupDefenseOwner, setupDefenseOwnerAndMember, openWarNode } from '../../support/e2e';

interface Owner {
  tok: string;
  acc: string;
  rarity?: string;
  preferred?: boolean;
}

// Load a champion once (as admin) and add it to each owner's roster — the two-step
// dance every test in this file repeats to build its fixtures.
function giveChampion(adminToken: string, name: string, cls: string, owners: Owner | Owner[], saga = false) {
  const load = saga
    ? cy.apiLoadChampionWithSaga(adminToken, name, cls, { is_saga_defender: true })
    : cy.apiLoadChampion(adminToken, name, cls);

  return load.then((champs: { id: string }[]) => {
    [owners]
      .flat()
      .forEach((o) =>
        cy.apiAddChampionToRoster(
          o.tok,
          o.acc,
          champs[0].id,
          o.rarity ?? '7r3',
          o.preferred === undefined ? undefined : { is_preferred_attacker: o.preferred },
        ),
      );
  });
}

// Same, then place that champion on a defense node for its owner.
function giveChampionAndPlace(
  adminToken: string,
  name: string,
  cls: string,
  o: Owner,
  allianceId: string,
  node: number,
) {
  return cy.apiLoadChampion(adminToken, name, cls).then((champs: { id: string }[]) => {
    cy.apiAddChampionToRoster(o.tok, o.acc, champs[0].id, o.rarity ?? '7r3').then((cu: { id: string }) => {
      cy.apiPlaceDefender(o.tok, allianceId, 1, node, cu.id, o.acc);
    });
  });
}

// The champion selector is a dialog opened by clicking a node on the defense map.
function openSelectorOnNode1() {
  openWarNode(1);
}

// What a filter left on screen and what it removed — the two assertions every
// test here makes, before and after acting on a filter.
function expectCards(visible: string[], hidden: string[] = []) {
  visible.forEach((name) => cy.getByCy(`champion-card-${name}`).should('be.visible'));
  hidden.forEach((name) => cy.getByCy(`champion-card-${name}`).should('not.exist'));
}

// Owner + their roster + the defense page with the selector open on node 1 —
// the preamble every single-player selector test repeats.
function openSelectorWithRoster(
  prefix: string,
  pseudo: string,
  allianceName: string,
  tag: string,
  roster: (admin: string, owner: Owner) => void,
) {
  return setupDefenseOwner(prefix, pseudo, allianceName, tag).then(({ adminData, ownerData, ownerAccId }) => {
    roster(adminData.access_token, { tok: ownerData.access_token, acc: ownerAccId });
    cy.apiLogin(ownerData.user_id, 'defense');
    openSelectorOnNode1();
  });
}

describe('Defense – AllianceDefenseSelector filters', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Class filter
  // =========================================================================

  it('class filter shows only champions of the selected class', () => {
    openSelectorWithRoster('def-flt-cls', 'ClsFilterPlyr', 'ClassAll', 'CF', (admin, owner) => {
      giveChampion(admin, 'Spider-Man', 'Cosmic', owner);
      giveChampion(admin, 'Wolverine', 'Mutant', owner);
    }).then(() => {
      expectCards(['Spider-Man', 'Wolverine']);

      cy.selectOption('selector-class-filter', 'Cosmic');

      expectCards(['Spider-Man'], ['Wolverine']);
    });
  });

  // =========================================================================
  // Player filter
  // =========================================================================

  it('player filter shows only champions owned by the selected player', () => {
    setupDefenseOwnerAndMember('def-flt-plyr', 'PlyrFltOwn', 'PlyrFltMem', 'PlyrAll', 'PF').then(
      ({ adminData, ownerData, memberData, ownerAccId, memberAccId }) => {
        const admin = adminData.access_token;
        giveChampion(admin, 'Spider-Man', 'Cosmic', { tok: ownerData.access_token, acc: ownerAccId });
        giveChampion(admin, 'Wolverine', 'Mutant', { tok: memberData.access_token, acc: memberAccId });

        cy.apiLogin(ownerData.user_id, 'defense');

        openSelectorOnNode1();
        expectCards(['Spider-Man', 'Wolverine']);

        cy.selectOption('selector-player-filter', 'PlyrFltOwn');

        expectCards(['Spider-Man'], ['Wolverine']);
      },
    );
  });

  // =========================================================================
  // Saga Defender toggle
  // =========================================================================

  it('saga defender toggle shows only saga defenders', () => {
    openSelectorWithRoster('def-flt-saga', 'SagaFltPlyr', 'SagaAll', 'SF', (admin, owner) => {
      giveChampion(admin, 'Spider-Man', 'Cosmic', owner, true);
      giveChampion(admin, 'Wolverine', 'Mutant', owner);
    }).then(() => {
      expectCards(['Spider-Man', 'Wolverine']);

      cy.getByCy('selector-toggle-saga').click();

      expectCards(['Spider-Man'], ['Wolverine']);
    });
  });

  // =========================================================================
  // Not Preferred toggle
  // =========================================================================

  it('not preferred toggle hides champion only when all its owners are preferred attackers', () => {
    setupDefenseOwnerAndMember('def-flt-npref-multi', 'NPrefMultiOwn', 'NPrefMultiMem', 'NPrefMultiAll', 'NM').then(
      ({ adminData, ownerData, memberData, ownerAccId, memberAccId }) => {
        // owner: preferred, member: not preferred → champion stays visible (at least one non-preferred owner)
        giveChampion(adminData.access_token, 'Spider-Man', 'Cosmic', [
          { tok: ownerData.access_token, acc: ownerAccId, preferred: true },
          { tok: memberData.access_token, acc: memberAccId, preferred: false },
        ]);

        cy.apiLogin(ownerData.user_id, 'defense');

        openSelectorOnNode1();
        expectCards(['Spider-Man']);

        cy.getByCy('selector-toggle-notPreferred').click();

        expectCards(['Spider-Man']);
      },
    );
  });

  it('not preferred toggle shows only champions whose owners are not preferred attackers', () => {
    openSelectorWithRoster('def-flt-npref', 'NPrefFltPlyr', 'NPrefAll', 'NP', (admin, owner) => {
      giveChampion(admin, 'Spider-Man', 'Cosmic', { ...owner, preferred: false });
      giveChampion(admin, 'Wolverine', 'Mutant', { ...owner, preferred: true });
    }).then(() => {
      expectCards(['Spider-Man', 'Wolverine']);

      cy.getByCy('selector-toggle-notPreferred').click();

      expectCards(['Spider-Man'], ['Wolverine']);
    });
  });

  // =========================================================================
  // Reset button
  // =========================================================================

  it('reset button clears all active filters and restores all champions', () => {
    openSelectorWithRoster('def-flt-reset', 'ResetFltPlyr', 'ResetAll', 'RF', (admin, owner) => {
      giveChampion(admin, 'Spider-Man', 'Cosmic', owner, true);
      giveChampion(admin, 'Wolverine', 'Mutant', owner);
    }).then(() => {
      // Activate saga filter → only Spider-Man visible
      cy.getByCy('selector-toggle-saga').click();
      expectCards([], ['Wolverine']);

      // Reset button appears and restores all champions
      cy.getByCy('selector-reset-filters').should('be.visible').click();
      expectCards(['Spider-Man', 'Wolverine']);
      cy.getByCy('selector-reset-filters').should('not.exist');
    });
  });

  // =========================================================================
  // Defense map player filter (member panel + node dimming)
  // =========================================================================

  it('defense-player-filter hides other member cards and dims their nodes on the map', () => {
    setupDefenseOwnerAndMember('def-mpflt', 'MPFltOwner', 'MPFltMember', 'MPFltAll', 'MPF').then(
      ({ adminData, ownerData, memberData, allianceId, ownerAccId, memberAccId }) => {
        const admin = adminData.access_token;
        const owner = { tok: ownerData.access_token, acc: ownerAccId };
        const member = { tok: memberData.access_token, acc: memberAccId };
        giveChampionAndPlace(admin, 'Spider-Man', 'Cosmic', owner, allianceId, 1);
        giveChampionAndPlace(admin, 'Wolverine', 'Mutant', member, allianceId, 2);

        cy.apiLogin(ownerData.user_id, 'defense');

        cy.getByCy('member-section-MPFltOwner').should('be.visible');
        cy.getByCy('member-section-MPFltMember').should('be.visible');

        cy.selectOption('defense-player-filter', 'MPFltOwner');

        cy.getByCy('member-section-MPFltOwner').should('be.visible');
        cy.getByCy('member-section-MPFltMember').should('not.exist');

        cy.getByCy('war-node-1').should('not.have.class', 'opacity-25');
        cy.getByCy('war-node-2').should('have.class', 'opacity-25');
      },
    );
  });

  it('defense-player-filter restores all members when reset to All', () => {
    setupDefenseOwnerAndMember('def-mpflt-r', 'MPFROwner', 'MPFRMember', 'MPFRAll', 'MFR').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        const owner = { tok: ownerData.access_token, acc: ownerAccId };
        giveChampionAndPlace(adminData.access_token, 'Spider-Man', 'Cosmic', owner, allianceId, 1);

        cy.apiLogin(ownerData.user_id, 'defense');

        cy.selectOption('defense-player-filter', 'MPFROwner');
        cy.getByCy('member-section-MPFRMember').should('not.exist');

        cy.selectOption('defense-player-filter', 'All');

        cy.getByCy('member-section-MPFROwner').should('be.visible');
        cy.getByCy('member-section-MPFRMember').should('be.visible');
      },
    );
  });

  // =========================================================================
  // Filters combine
  // =========================================================================

  it('class and saga filters combine to narrow results', () => {
    openSelectorWithRoster('def-flt-comb', 'CombFltPlyr', 'CombAll', 'CB', (admin, owner) => {
      giveChampion(admin, 'Spider-Man', 'Cosmic', owner, true);
      giveChampion(admin, 'Iron Man', 'Tech', owner, true);
      giveChampion(admin, 'Wolverine', 'Mutant', owner);
    }).then(() => {
      // Saga filter → Spider-Man + Iron Man visible
      cy.getByCy('selector-toggle-saga').click();
      expectCards(['Spider-Man', 'Iron-Man'], ['Wolverine']);

      // Add class filter Cosmic → only Spider-Man
      cy.selectOption('selector-class-filter', 'Cosmic');
      expectCards(['Spider-Man'], ['Iron-Man']);
    });
  });
});

describe('Defense – AllianceDefenseSelector rarity filter', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // 6★ champions are hidden by default but a toggle reveals them
  // =========================================================================

  it('hides 6-star champions by default and reveals them via the 6-star toggle', () => {
    openSelectorWithRoster('def-rar-def', 'RarDefPlyr', 'RarDefAll', 'RD', (admin, owner) => {
      giveChampion(admin, 'Spider-Man', 'Cosmic', owner);
      giveChampion(admin, 'Wolverine', 'Mutant', { ...owner, rarity: '6r5' });
    }).then(() => {
      // 7★ Spider-Man visible, 6★ Wolverine hidden by default
      expectCards(['Spider-Man'], ['Wolverine']);

      // The rarity filter exposes 6★ tiers too — enabling 6r5 reveals the champion.
      cy.getByCy('defense-rarity-6r4').should('be.visible');
      cy.getByCy('defense-rarity-7r3').should('be.visible');
      cy.getByCy('defense-rarity-6r5').click();
      expectCards(['Wolverine', 'Spider-Man']);
    });
  });

  // =========================================================================
  // Toggling a 7★ tier off hides that tier
  // =========================================================================

  it('deactivating a 7-star tier hides champions of that exact tier', () => {
    openSelectorWithRoster('def-rar-tier', 'RarTierPlyr', 'RarTierAll', 'RT', (admin, owner) => {
      giveChampion(admin, 'Spider-Man', 'Cosmic', owner);
      giveChampion(admin, 'Wolverine', 'Mutant', { ...owner, rarity: '7r5' });
    }).then(() => {
      expectCards(['Spider-Man', 'Wolverine']);

      // Turn 7r3 off → Spider-Man (7r3) hidden, Wolverine (7r5) stays
      cy.getByCy('defense-rarity-7r3').click();
      expectCards(['Wolverine'], ['Spider-Man']);
    });
  });

  // =========================================================================
  // Persistence + independence from Reset
  // =========================================================================

  it('persists the rarity preference across reopen and is untouched by Reset', () => {
    // Spider-Man 7r3 and Wolverine 7r5 (saga defender)
    openSelectorWithRoster('def-rar-persist', 'RarPersPlyr', 'RarPersAll', 'RP', (admin, owner) => {
      giveChampion(admin, 'Spider-Man', 'Cosmic', owner);
      giveChampion(admin, 'Wolverine', 'Mutant', { ...owner, rarity: '7r5' }, true);
    }).then(() => {
      // Turn 7r3 off → Spider-Man (7r3) hidden, Wolverine (7r5) stays
      cy.getByCy('defense-rarity-7r3').click();
      expectCards(['Wolverine'], ['Spider-Man']);

      // Activate then Reset a normal filter — rarity must survive
      cy.getByCy('selector-toggle-saga').click();
      cy.getByCy('selector-reset-filters').click();
      expectCards(['Wolverine'], ['Spider-Man']);

      // Close and reopen the dialog — preference persisted via localStorage
      cy.get('body').type('{esc}');
      expectCards([], ['Wolverine']);
      openSelectorOnNode1();
      expectCards(['Wolverine'], ['Spider-Man']);
    });
  });

  // =========================================================================
  // Sorting: preferred first, then rank descending
  // =========================================================================

  it('orders champions preferred-first then by descending rank', () => {
    openSelectorWithRoster('def-rar-sort', 'RarSortPlyr', 'RarSortAll', 'RS', (admin, owner) => {
      giveChampion(admin, 'Spider-Man', 'Cosmic', { ...owner, rarity: '7r5' });
      giveChampion(admin, 'Wolverine', 'Mutant', owner);
      giveChampion(admin, 'Iron Man', 'Tech', { ...owner, rarity: '7r1', preferred: true });
    }).then(() => {
      // Expected order: Iron Man (preferred) → Spider-Man (7r5) → Wolverine (7r3)
      cy.get('[data-cy^="champion-card-"]').then(($cards) => {
        const order = [...$cards].map((el) => el.getAttribute('data-cy'));
        expect(order).to.deep.equal(['champion-card-Iron-Man', 'champion-card-Spider-Man', 'champion-card-Wolverine']);
      });
    });
  });
});
