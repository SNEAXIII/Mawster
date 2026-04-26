import { setupDefenseOwner, setupDefenseScenario, setupDefenseOwnerAndMember } from '../../support/e2e';

describe('Defense – Champion Selector & Owner Picker', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Champion selector: search filter
  // =========================================================================

  it('search filter in champion selector filters champions by name', () => {
    setupDefenseScenario('def-pl-search', 'SearchPlyr', 'SR', [
      { name: 'Spider-Man', cls: 'Cosmic', rarity: '7r3' },
      { name: 'Wolverine', cls: 'Mutant', rarity: '7r3' },
      { name: 'Iron Man', cls: 'Tech', rarity: '7r3' },
    ]).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('defense');

      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
      cy.contains('Select Champion').should('be.visible');

      cy.getByCy('champion-card-Spider-Man').should('be.visible');
      cy.getByCy('champion-card-Wolverine').should('be.visible');
      cy.getByCy('champion-card-Iron-Man').should('be.visible');

      cy.get('input[placeholder]').type('spider');
      cy.getByCy('champion-card-Spider-Man').should('be.visible');
      cy.getByCy('champion-card-Wolverine').should('not.exist');
      cy.getByCy('champion-card-Iron-Man').should('not.exist');
    });
  });

  it('search filter by champion class', () => {
    setupDefenseScenario('def-pl-class-search', 'ClsSearchPlyr', 'CS', [
      { name: 'Spider-Man', cls: 'Cosmic', rarity: '7r3' },
      { name: 'Wolverine', cls: 'Mutant', rarity: '7r3' },
    ]).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('defense');

      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
      cy.get('input[placeholder]').type('mutant');
      cy.getByCy('champion-card-Wolverine').should('be.visible');
      cy.getByCy('champion-card-Spider-Man').should('not.exist');
    });
  });

  it('search filter by champion alias finds the champion', () => {
    setupDefenseOwner('def-pl-alias-search', 'AliasPlyr', 'AliasAll', 'AS').then(
      ({ adminData, ownerData, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic', { alias: 'spidey;peter' }).then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3');
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.contains('Select Champion').should('be.visible');

        // Search by alias — "spidey" should surface Spider-Man only
        cy.get('input[placeholder]').type('spidey');
        cy.getByCy('champion-card-Spider-Man').should('be.visible');
        cy.getByCy('champion-card-Wolverine').should('not.exist');
      },
    );
  });

  // =========================================================================
  // Champion selector: rarity & ascension labels in selector grid
  // =========================================================================

  it('champion selector shows rarity label and ascension badge for each champion card', () => {
    setupDefenseScenario('def-pl-sel-label', 'SelLabelPlyr', 'SL', [
      { name: 'Spider-Man', cls: 'Cosmic', rarity: '7r5', options: { ascension: 1, is_ascendable: true } },
      { name: 'Wolverine', cls: 'Mutant', rarity: '7r3' },
    ]).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('defense');

      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });

      cy.getByCy('champion-card-Spider-Man').should('contain', '7R5').and('contain', 'A1');
      cy.getByCy('champion-card-Wolverine').should('contain', '7R3').and('not.contain', '· A');
    });
  });

  // =========================================================================
  // Already placed champion excluded from selector
  // =========================================================================

  it('placed champion is excluded from the selector for second placement', () => {
    setupDefenseScenario('def-pl-excl', 'ExclPlyr', 'EX', [
      { name: 'Spider-Man', cls: 'Cosmic', rarity: '7r3', options: { signature: 200 } },
      { name: 'Wolverine', cls: 'Mutant', rarity: '7r3', options: { signature: 100 } },
    ]).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('defense');

      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
      cy.getByCy('champion-card-Spider-Man').click();
      cy.contains('Spider-Man placed on node #1').should('be.visible');

      cy.getByCy('war-node-2').scrollIntoView().click({ force: true });
      cy.contains('Select Champion').should('be.visible');
      cy.getByCy('champion-card-Spider-Man').should('not.exist');
      cy.getByCy('champion-card-Wolverine').should('be.visible');
    });
  });

  // =========================================================================
  // Replace champion on occupied node
  // =========================================================================

  it('clicking an occupied node opens selector and replaces the defender', () => {
    setupDefenseScenario('def-pl-replace', 'ReplPlyr', 'RP', [
      { name: 'Spider-Man', cls: 'Cosmic', rarity: '7r3', options: { signature: 200 } },
      { name: 'Wolverine', cls: 'Mutant', rarity: '7r4', options: { signature: 100 } },
    ]).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('defense');

      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
      cy.getByCy('champion-card-Spider-Man').click();
      cy.getByCy('war-node-1').should('contain', '7R3·200');

      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
      cy.contains('Select Champion').should('be.visible');
      cy.getByCy('champion-card-Wolverine').click();

      cy.getByCy('war-node-1').should('contain', '7R4·100');
      cy.getByCy('defender-count-ReplPlyr').should('contain', '1/5');
    });
  });

  // =========================================================================
  // Multi-owner champion: owner picker
  // =========================================================================

  it('shows owner picker when champion has multiple owners', () => {
    setupDefenseOwnerAndMember('def-pl-multi', 'MultiOwn', 'MultiMem', 'MultiAll', 'MO').then(
      ({ adminData, ownerData, memberData, ownerAccId, memberAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5', { signature: 200 });
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3', { signature: 100 });
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Spider-Man').click();
        cy.contains('Select Player').should('be.visible');

        cy.getByCy('owner-row-MultiOwn')
          .should('be.visible')
          .and('contain', '7R5')
          .and('contain', 'sig 200')
          .and('contain', '0/5');
        cy.getByCy('owner-row-MultiMem')
          .should('be.visible')
          .and('contain', '7R3')
          .and('contain', 'sig 100')
          .and('contain', '0/5');

        cy.getByCy('owner-row-MultiOwn').click();
        cy.contains('Spider-Man placed on node #1').should('be.visible');
        cy.getByCy('defender-count-MultiOwn').should('contain', '1/5');
      },
    );
  });

  it('owner picker shows preferred attacker ⚔ flag and 7 badge', () => {
    setupDefenseOwnerAndMember('def-pl-opref', 'OPrefOwn', 'OPrefMem', 'OPrefAll', 'OP').then(
      ({ adminData, ownerData, memberData, ownerAccId, memberAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5', {
            signature: 200,
            is_preferred_attacker: true,
          });
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3', {
            signature: 50,
            is_preferred_attacker: false,
          });
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Wolverine').click();
        cy.contains('Select Player').should('be.visible');

        cy.getByCy('owner-row-OPrefOwn').find('[data-cy="preferred-badge"]').should('exist');
        cy.getByCy('owner-row-OPrefOwn').should('contain', '7');
        cy.getByCy('owner-row-OPrefMem').find('[data-cy="preferred-badge"]').should('not.exist');
      },
    );
  });

  it('owner picker shows ascension in rarity label', () => {
    setupDefenseOwnerAndMember('def-pl-oasc', 'OAscOwn', 'OAscMem', 'OAscAll', 'OA').then(
      ({ adminData, ownerData, memberData, ownerAccId, memberAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Doctor Doom', 'Mystic', { is_ascendable: true }).then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5', {
            signature: 200,
            ascension: 2,
          });
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r5', {
            signature: 100,
            ascension: 0,
          });
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Doctor-Doom').click();
        cy.contains('Select Player').should('be.visible');

        cy.getByCy('owner-row-OAscOwn').should('contain', 'A2').and('contain', 'sig 200');
        cy.getByCy('owner-row-OAscMem').should('not.contain', '· A').and('contain', 'sig 100');
      },
    );
  });

  // =========================================================================
  // Two players: correct isolation
  // =========================================================================

  it("champion placed for player A appears only in player A's section", () => {
    setupDefenseOwnerAndMember('def-pl-iso', 'IsoOwner', 'IsoMember', 'IsoAll', 'IS').then(
      ({ adminData, ownerData, memberData, ownerAccId, memberAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5', { signature: 200 }),
        );
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) =>
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r4', { signature: 100 }),
        );

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Spider-Man').should('be.visible').click();
        cy.contains('Spider-Man placed on node #1').should('be.visible');

        cy.getByCy('war-node-2').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Wolverine').should('be.visible').click();

        cy.getByCy('member-section-IsoOwner').find('[title*="Spider-Man"]').should('exist');
        cy.getByCy('member-section-IsoOwner').find('[title*="Wolverine"]').should('not.exist');
        cy.getByCy('member-section-IsoMember').find('[title*="Wolverine"]').should('exist');
        cy.getByCy('member-section-IsoMember').find('[title*="Spider-Man"]').should('not.exist');

        cy.getByCy('defender-count-IsoOwner').should('contain', '1/5');
        cy.getByCy('defender-count-IsoMember').should('contain', '1/5');
      },
    );
  });

  // =========================================================================
  // Current placement entry in selector
  // =========================================================================

  it('selector shows empty node entry when node has no defender', () => {
    setupDefenseScenario('def-pl-entry-empty', 'EntryEmptyPlyr', 'EE', [
      { name: 'Spider-Man', cls: 'Cosmic', rarity: '7r3' },
    ]).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('defense');

      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
      cy.getByCy('defense-current-placement').should('contain', 'Empty');
    });
  });

  it('selector shows current champion and player when node already has a defender', () => {
    setupDefenseScenario('def-pl-entry-filled', 'EntryFilledPlyr', 'EF', [
      { name: 'Spider-Man', cls: 'Cosmic', rarity: '7r3' },
      { name: 'Wolverine', cls: 'Mutant', rarity: '7r4' },
    ]).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('defense');

      // Place Spider-Man on node 1
      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
      cy.getByCy('champion-card-Spider-Man').click();

      // Reopen node 1 — should show Spider-Man as current placement
      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
      cy.getByCy('defense-current-placement').should('contain', 'Spider-Man').and('contain', 'EntryFilledPlyr');
    });
  });

  // =========================================================================
  // Node title verification
  // =========================================================================

  it('war map node title updates after placement', () => {
    setupDefenseScenario('def-pl-title', 'TitlePlyr', 'TT', [
      { name: 'Spider-Man', cls: 'Cosmic', rarity: '7r3', options: { signature: 200 } },
    ]).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('defense');

      cy.getByCy('war-node-1').should('have.attr', 'title').and('include', 'Empty');

      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
      cy.getByCy('champion-card-Spider-Man').click();

      cy.getByCy('war-node-1').should('have.attr', 'title').and('include', 'Spider-Man').and('include', 'TitlePlyr');
    });
  });
});
