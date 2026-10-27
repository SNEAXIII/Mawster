import { setupAttackerScenario, openWarNode, sliderThumb } from '../../support/e2e';

/** Pseudos built by setupAttackerScenario — mirrors its `${prefix}Owner`.slice(0, 16). */
const ownerPseudo = (prefix: string) => `${prefix}Owner`.slice(0, 16);
const memberPseudo = (prefix: string) => `${prefix}Member`.slice(0, 16);

/** Log in, switch to attackers mode and open the selector on BG1 node 10. */
function openAttackerSelector(userId: string) {
  cy.goToWarMode(userId, 'attackers');
  openWarNode(10);
  cy.getByCy('war-attacker-search').should('be.visible');
}

interface RosterChampion {
  name: string;
  cls?: string;
  rarity?: string;
  saga?: boolean;
  preferred?: boolean;
}

/** Load a champion as admin and put it on the given account's roster. */
function giveChampion(
  adminToken: string,
  token: string,
  accountId: string,
  { name, cls = 'Mutant', rarity = '7r3', saga = false, preferred }: RosterChampion,
) {
  const load = saga
    ? cy.apiLoadChampionWithSaga(adminToken, name, cls, { is_saga_attacker: true })
    : cy.apiLoadChampion(adminToken, name, cls);

  load.then((champs: { id: string }[]) => {
    cy.apiAddChampionToRoster(
      token,
      accountId,
      champs[0].id,
      rarity,
      preferred === undefined ? undefined : { is_preferred_attacker: preferred },
    );
  });
}

const expectVisible = (...names: string[]) =>
  names.forEach((name) => cy.getByCy(`attacker-card-${name}`).should('be.visible'));

const expectHidden = (...names: string[]) =>
  names.forEach((name) => cy.getByCy(`attacker-card-${name}`).should('not.exist'));

/** Two member groups overflow the dialog's scrollable list — scroll before asserting. */
const expectVisibleInList = (...names: string[]) =>
  names.forEach((name) => cy.getByCy(`attacker-card-${name}`).scrollIntoView().should('be.visible'));

const lowRankThumb = () => sliderThumb('war-attacker-rarity');

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
      giveChampion(adminToken, memberData.access_token, memberAccId, { name: 'Vision', cls: 'Tech' });

      openAttackerSelector(ownerData.user_id);

      // Both attackers visible initially
      expectVisible('Wolverine', 'Vision');

      // Filter by Tech → only Vision
      cy.selectOption('selector-class-filter', 'Tech');
      expectVisible('Vision');
      expectHidden('Wolverine');

      // Filter by Mutant → only Wolverine
      cy.selectOption('selector-class-filter', 'Mutant');
      expectVisible('Wolverine');
      expectHidden('Vision');
    });
  });

  // =========================================================================
  // Saga Attacker toggle
  // =========================================================================

  it('saga attacker toggle shows only saga attackers', () => {
    setupAttackerScenario('atk-flt-saga').then(({ adminToken, ownerData, memberData, memberAccId }) => {
      giveChampion(adminToken, memberData.access_token, memberAccId, { name: 'Storm', saga: true });

      openAttackerSelector(ownerData.user_id);

      // Both visible initially (Wolverine = non-saga, Storm = saga)
      expectVisible('Wolverine', 'Storm');

      cy.getByCy('selector-toggle-saga').click();

      expectVisible('Storm');
      expectHidden('Wolverine');
    });
  });

  // =========================================================================
  // Preferred Attacker toggle
  // =========================================================================

  it('preferred attacker toggle shows only preferred attackers', () => {
    setupAttackerScenario('atk-flt-pref').then(({ adminToken, ownerData, memberData, memberAccId }) => {
      giveChampion(adminToken, memberData.access_token, memberAccId, { name: 'Storm', preferred: true });

      openAttackerSelector(ownerData.user_id);

      // Both visible initially
      expectVisible('Wolverine', 'Storm');

      cy.getByCy('selector-toggle-preferred').click();

      // Only Storm (preferred) visible
      expectVisible('Storm');
      expectHidden('Wolverine');
    });
  });

  // =========================================================================
  // Player filter
  // =========================================================================

  it('player filter shows only the selected player attackers', () => {
    const prefix = 'atk';

    setupAttackerScenario(prefix).then(({ adminToken, ownerData, ownerAccId }) => {
      // Owner gets Storm; member already has Wolverine
      giveChampion(adminToken, ownerData.access_token, ownerAccId, { name: 'Storm' });

      openAttackerSelector(ownerData.user_id);

      // Both attackers visible initially
      expectVisibleInList('Storm', 'Wolverine');

      // Filter by member → only Wolverine
      cy.selectOption('selector-player-filter', memberPseudo(prefix));
      expectVisible('Wolverine');
      expectHidden('Storm');

      // Switch to owner → only Storm
      cy.selectOption('selector-player-filter', ownerPseudo(prefix));
      expectVisible('Storm');
      expectHidden('Wolverine');
    });
  });

  it('player filter combines with class filter', () => {
    const prefix = 'atk';

    setupAttackerScenario(prefix).then(({ adminToken, ownerData, ownerAccId }) => {
      // Owner gets Storm (Mutant) and Vision (Tech); member already has Wolverine (Mutant)
      giveChampion(adminToken, ownerData.access_token, ownerAccId, { name: 'Storm' });
      giveChampion(adminToken, ownerData.access_token, ownerAccId, { name: 'Vision', cls: 'Tech' });

      openAttackerSelector(ownerData.user_id);

      // Filter by owner + Mutant → only Storm (Vision excluded by class, Wolverine excluded by player)
      cy.selectOption('selector-player-filter', ownerPseudo(prefix));
      cy.selectOption('selector-class-filter', 'Mutant');

      expectVisible('Storm');
      expectHidden('Vision', 'Wolverine');
    });
  });

  it('reset button clears player filter and restores all players attackers', () => {
    const prefix = 'atk';

    setupAttackerScenario(prefix).then(({ adminToken, ownerData, ownerAccId }) => {
      giveChampion(adminToken, ownerData.access_token, ownerAccId, { name: 'Storm' });

      openAttackerSelector(ownerData.user_id);

      cy.selectOption('selector-player-filter', ownerPseudo(prefix));
      expectHidden('Wolverine');

      cy.getByCy('selector-reset-filters').click();
      // Both groups are restored and overflow the list
      expectVisibleInList('Storm', 'Wolverine');
      cy.getByCy('selector-reset-filters').should('not.exist');
    });
  });

  // =========================================================================
  // Reset button
  // =========================================================================

  it('reset button clears all active filters and restores all attackers', () => {
    setupAttackerScenario('atk-flt-reset').then(({ adminToken, ownerData, memberData, memberAccId }) => {
      giveChampion(adminToken, memberData.access_token, memberAccId, { name: 'Storm', saga: true });

      openAttackerSelector(ownerData.user_id);

      // Activate saga filter → only Storm
      cy.getByCy('selector-toggle-saga').click();
      expectHidden('Wolverine');

      // Reset → all attackers back, reset button disappears
      cy.getByCy('selector-reset-filters').should('be.visible').click();
      expectVisible('Wolverine', 'Storm');
      cy.getByCy('selector-reset-filters').should('not.exist');
    });
  });

  // =========================================================================
  // Filters combine
  // =========================================================================

  it('saga and preferred filters combine to narrow results', () => {
    setupAttackerScenario('atk-flt-comb').then(({ adminToken, ownerData, memberData, memberAccId }) => {
      giveChampion(adminToken, memberData.access_token, memberAccId, {
        name: 'Storm',
        saga: true,
        preferred: true,
      });
      giveChampion(adminToken, memberData.access_token, memberAccId, {
        name: 'Deadpool',
        saga: true,
        preferred: false,
      });

      openAttackerSelector(ownerData.user_id);

      // Saga filter → Storm + Deadpool (both saga), not Wolverine
      cy.getByCy('selector-toggle-saga').click();
      expectVisible('Storm', 'Deadpool');
      expectHidden('Wolverine');

      // Add preferred filter → only Storm (saga + preferred)
      cy.getByCy('selector-toggle-preferred').click();
      expectVisible('Storm');
      expectHidden('Deadpool');
    });
  });
});

describe('War – WarAttackerSelector rarity filter', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // 6★ attackers are hidden by default but a toggle reveals them
  // =========================================================================

  it('hides 6-star attackers by default and reveals them when the low end moves down', () => {
    setupAttackerScenario('atk-rar-def').then(({ adminToken, memberData, ownerData, memberAccId }) => {
      // Member already has Wolverine 7r3; add a 6r5 champion
      giveChampion(adminToken, memberData.access_token, memberAccId, { name: 'Storm', rarity: '6r5' });

      openAttackerSelector(ownerData.user_id);

      // 7★ Wolverine visible, 6★ Storm hidden by default
      expectVisible('Wolverine');
      expectHidden('Storm');

      // One step left puts the low end on 6r5 (index 1) and reveals the attacker.
      cy.getByCy('war-attacker-rarity').should('be.visible');
      lowRankThumb().type('{leftarrow}').should('have.attr', 'aria-valuenow', '1');
      expectVisible('Storm', 'Wolverine');
    });
  });

  // =========================================================================
  // Raising the low end hides the ranks below it
  // =========================================================================

  it('raising the low end of the range hides attackers below it', () => {
    setupAttackerScenario('atk-rar-tier').then(({ adminToken, memberData, ownerData, memberAccId }) => {
      // Member has Wolverine 7r3; add Storm at 7r5
      giveChampion(adminToken, memberData.access_token, memberAccId, { name: 'Storm', rarity: '7r5' });

      openAttackerSelector(ownerData.user_id);

      // Both 7★ visible by default
      expectVisible('Wolverine', 'Storm');

      // Low end 7r1 → 7r4 hides Wolverine (7r3), Storm (7r5) stays
      lowRankThumb().type('{rightarrow}{rightarrow}{rightarrow}').should('have.attr', 'aria-valuenow', '5');
      expectHidden('Wolverine');
      expectVisible('Storm');
    });
  });

  // =========================================================================
  // Persistence + independence from Reset
  // =========================================================================

  it('persists the rarity preference across reopen and is untouched by Reset', () => {
    setupAttackerScenario('atk-rar-persist').then(({ adminToken, memberData, ownerData, memberAccId }) => {
      // Member has Wolverine 7r3; add Storm at 7r5
      giveChampion(adminToken, memberData.access_token, memberAccId, { name: 'Storm', rarity: '7r5' });

      openAttackerSelector(ownerData.user_id);

      // Low end 7r1 → 7r4 hides Wolverine (7r3), Storm (7r5) stays
      lowRankThumb().type('{rightarrow}{rightarrow}{rightarrow}').should('have.attr', 'aria-valuenow', '5');
      expectHidden('Wolverine');
      expectVisible('Storm');

      // Activate then Reset a normal filter — rarity must survive
      cy.getByCy('selector-toggle-saga').click();
      cy.getByCy('selector-reset-filters').click();
      expectHidden('Wolverine');
      expectVisible('Storm');

      // Close and reopen the dialog — preference persisted via localStorage
      cy.get('body').type('{esc}');
      cy.getByCy('war-attacker-search').should('not.exist');
      openWarNode(10);
      cy.getByCy('war-attacker-search').should('be.visible');
      expectHidden('Wolverine');
      expectVisible('Storm');

      // A page reload reads it back from storage
      cy.reload();
      cy.getByCy('war-mode-attackers').click();
      openWarNode(10);
      cy.getByCy('war-attacker-search').should('be.visible');
      lowRankThumb().should('have.attr', 'aria-valuenow', '5');
      expectHidden('Wolverine');
      expectVisible('Storm');
    });
  });

  // =========================================================================
  // Sorting: preferred first, then rank descending
  // =========================================================================

  it('sorts each member group preferred-first then by descending rank', () => {
    setupAttackerScenario('atk-rar-sort').then(({ adminToken, memberData, ownerData, memberAccId }) => {
      // Member has Wolverine 7r3 (not preferred); add Storm 7r5 (not preferred)
      // and Deadpool 7r1 (preferred).
      giveChampion(adminToken, memberData.access_token, memberAccId, { name: 'Storm', rarity: '7r5' });
      giveChampion(adminToken, memberData.access_token, memberAccId, {
        name: 'Deadpool',
        rarity: '7r1',
        preferred: true,
      });

      openAttackerSelector(ownerData.user_id);

      // Expected order: Deadpool (preferred) → Storm (7r5) → Wolverine (7r3)
      cy.get('[data-cy^="attacker-card-"]').then(($cards) => {
        const order = [...$cards].map((el) => el.getAttribute('data-cy'));
        expect(order).to.deep.equal(['attacker-card-Deadpool', 'attacker-card-Storm', 'attacker-card-Wolverine']);
      });
    });
  });
});
