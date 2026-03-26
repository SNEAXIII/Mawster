import { setupDefenseScenario } from '../../support/e2e';

describe('Defense – Placement via UI', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Single champion placement via UI click
  // =========================================================================

  it('places a champion on node #1 via UI click and verifies side panel', () => {
    setupDefenseScenario('def-pl-single', 'PlacePlyr', 'PS', [
      { name: 'Spider-Man', cls: 'Cosmic', rarity: '7r3', options: { signature: 200 } },
    ]).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('defense');

      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
      cy.contains('Select Champion').should('be.visible');
      cy.contains('Node #1').should('be.visible');

      cy.getByCy('champion-card-Spider-Man').click();

      cy.contains('Spider-Man placed on node #1').should('be.visible');
      cy.getByCy('defender-count-PlacePlyr').should('contain', '1/5');
      cy.getByCy('member-section-PlacePlyr').find('[title*="Spider-Man"]').should('exist');
      cy.getByCy('war-node-1').should('contain', 'PlacePlyr');
    });
  });

  // =========================================================================
  // Rarity labels on war map and side panel
  // =========================================================================

  (
    [
      {
        prefix: 'def-pl-label',
        pseudo: 'LabelPlyr',
        tag: 'LB',
        node: 1,
        expected: '7★R3·200',
        champ: { name: 'Spider-Man', cls: 'Cosmic', rarity: '7r3', options: { signature: 200 } },
      },
      {
        prefix: 'def-pl-asc',
        pseudo: 'AscPlyr',
        tag: 'AS',
        node: 10,
        expected: '7★R5·A1·200',
        champ: {
          name: 'Doctor Doom',
          cls: 'Mystic',
          rarity: '7r5',
          options: { signature: 200, ascension: 1, is_ascendable: true },
        },
      },
      {
        prefix: 'def-pl-asc2',
        pseudo: 'Asc2Plyr',
        tag: 'A2',
        node: 5,
        expected: '7★R5·A2·200',
        champ: {
          name: 'Blade',
          cls: 'Skill',
          rarity: '7r5',
          options: { signature: 200, ascension: 2, is_ascendable: true },
        },
      },
      {
        prefix: 'def-pl-zsig',
        pseudo: 'ZSigPlyr',
        tag: 'ZS',
        node: 3,
        expected: '7★R4·0',
        champ: { name: 'Wolverine', cls: 'Mutant', rarity: '7r4', options: { signature: 0 } },
      },
      {
        prefix: 'def-pl-6star',
        pseudo: 'SixPlyr',
        tag: '6S',
        node: 7,
        expected: '6★R5·20',
        champ: { name: 'Hulk', cls: 'Science', rarity: '6r5', options: { signature: 20 } },
      },
    ] as const
  ).forEach(({ prefix, pseudo, tag, node, expected, champ }) => {
    it(`shows correct rarity label ${expected} on war map and side panel`, () => {
      setupDefenseScenario(prefix, pseudo, tag, [champ]).then(({ ownerData }) => {
        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy(`war-node-${node}`).scrollIntoView().click({ force: true });
        cy.getByCy(`champion-card-${champ.name.replace(/ /g, '-')}`).click();

        cy.getByCy(`war-node-${node}`).should('contain', expected);
        cy.getByCy(`defender-card-${node}`).should('contain', expected);
      });
    });
  });

  // =========================================================================
  // Preferred attacker display
  // =========================================================================

  it('preferred attacker shows ⚔ prefix, non-preferred does not', () => {
    setupDefenseScenario('def-pl-pref', 'PrefPlyr', 'PR', [
      { name: 'Iron Man', cls: 'Tech', rarity: '7r5', options: { signature: 200, is_preferred_attacker: true } },
      { name: 'Wolverine', cls: 'Mutant', rarity: '7r3', options: { signature: 100, is_preferred_attacker: false } },
    ]).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('defense');

      cy.getByCy('war-node-20').scrollIntoView().click({ force: true });
      cy.getByCy('champion-card-Iron-Man').click();
      cy.getByCy('war-node-20').should('contain', '⚔');
      cy.getByCy('war-node-20').should('contain', '7★R5·200');
      cy.getByCy('defender-card-20').should('contain', '⚔');

      cy.getByCy('war-node-15').scrollIntoView().click({ force: true });
      cy.getByCy('champion-card-Wolverine').click();
      cy.getByCy('war-node-15').should('not.contain', '⚔');
      cy.getByCy('defender-card-15').should('not.contain', '⚔');
    });
  });

  // =========================================================================
  // Preferred attacker shown in selector dialog
  // =========================================================================

  it('champion selector shows ⚔ marker for preferred attacker champions', () => {
    setupDefenseScenario('def-pl-sel-pref', 'SelPrefPlyr', 'SP', [
      { name: 'Captain America', cls: 'Science', rarity: '7r3', options: { is_preferred_attacker: true } },
      { name: 'Wolverine', cls: 'Mutant', rarity: '7r3', options: { is_preferred_attacker: false } },
    ]).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('defense');

      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
      cy.contains('Select Champion').should('be.visible');

      cy.getByCy('champion-card-Captain-America').should('contain', '⚔');
      cy.getByCy('champion-card-Wolverine').should('not.contain', '⚔');
    });
  });

  // =========================================================================
  // Multiple sequential placements via UI
  // =========================================================================

  it('places 3 champions sequentially via UI and verifies all labels and counts', () => {
    setupDefenseScenario('def-pl-seq', 'SeqPlyr', 'SQ', [
      {
        name: 'Spider-Man',
        cls: 'Cosmic',
        rarity: '7r5',
        options: { signature: 200, is_preferred_attacker: true, ascension: 1, is_ascendable: true },
      },
      { name: 'Wolverine', cls: 'Mutant', rarity: '7r4', options: { signature: 100 } },
      { name: 'Iron Man', cls: 'Tech', rarity: '7r3', options: { signature: 20 } },
    ]).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('defense');

      cy.getByCy('war-node-50').scrollIntoView().click({ force: true });
      cy.getByCy('champion-card-Spider-Man').click();
      cy.contains('Spider-Man placed on node #50').should('be.visible');
      cy.getByCy('defender-count-SeqPlyr').should('contain', '1/5');

      cy.getByCy('war-node-40').scrollIntoView().click({ force: true });
      cy.getByCy('champion-card-Wolverine').click();
      cy.contains('Wolverine placed on node #40').should('be.visible');
      cy.getByCy('defender-count-SeqPlyr').should('contain', '2/5');

      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
      cy.getByCy('champion-card-Iron-Man').click();
      cy.contains('Iron Man placed on node #1').should('be.visible');
      cy.getByCy('defender-count-SeqPlyr').should('contain', '3/5');

      cy.getByCy('war-node-50').should('contain', '⚔').and('contain', '7★R5·A1·200').and('contain', 'SeqPlyr');
      cy.getByCy('war-node-40').should('not.contain', '⚔').and('contain', '7★R4·100').and('contain', 'SeqPlyr');
      cy.getByCy('war-node-1').should('not.contain', '⚔').and('contain', '7★R3·20').and('contain', 'SeqPlyr');

      cy.getByCy('defender-card-50').should('contain', '7★R5·A1·200').and('contain', '⚔');
      cy.getByCy('defender-card-40').should('contain', '7★R4·100');
      cy.getByCy('defender-card-1').should('contain', '7★R3·20');

      cy.getByCy('defender-card-50').should('contain', '#50');
      cy.getByCy('defender-card-40').should('contain', '#40');
      cy.getByCy('defender-card-1').should('contain', '#1');
    });
  });

  it('places 5 champions via UI and counter shows 5/5', () => {
    setupDefenseScenario('def-pl-five', 'FivePlyr', 'FV', [
      { name: 'Spider-Man', cls: 'Cosmic', rarity: '7r5', options: { signature: 200 } },
      { name: 'Wolverine', cls: 'Mutant', rarity: '7r4', options: { signature: 100 } },
      { name: 'Iron Man', cls: 'Tech', rarity: '7r3', options: { signature: 20 } },
      {
        name: 'Doctor Doom',
        cls: 'Mystic',
        rarity: '7r5',
        options: { signature: 200, ascension: 2, is_ascendable: true },
      },
      { name: 'Blade', cls: 'Skill', rarity: '7r3', options: { signature: 0 } },
    ]).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('defense');

      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
      cy.getByCy('champion-card-Spider-Man').click();
      cy.getByCy('defender-count-FivePlyr').should('contain', '1/5');

      cy.getByCy('war-node-2').scrollIntoView().click({ force: true });
      cy.getByCy('champion-card-Wolverine').click();
      cy.getByCy('defender-count-FivePlyr').should('contain', '2/5');

      cy.getByCy('war-node-3').scrollIntoView().click({ force: true });
      cy.getByCy('champion-card-Iron-Man').click();
      cy.getByCy('defender-count-FivePlyr').should('contain', '3/5');

      cy.getByCy('war-node-4').scrollIntoView().click({ force: true });
      cy.getByCy('champion-card-Doctor-Doom').click();
      cy.getByCy('defender-count-FivePlyr').should('contain', '4/5');

      cy.getByCy('war-node-5').scrollIntoView().click({ force: true });
      cy.getByCy('champion-card-Blade').click();
      cy.getByCy('defender-count-FivePlyr').should('contain', '5/5');

      cy.getByCy('war-node-1').should('contain', '7★R5·200');
      cy.getByCy('war-node-2').should('contain', '7★R4·100');
      cy.getByCy('war-node-3').should('contain', '7★R3·20');
      cy.getByCy('war-node-4').should('contain', '7★R5·A2·200');
      cy.getByCy('war-node-5').should('contain', '7★R3·0');
    });
  });
});
