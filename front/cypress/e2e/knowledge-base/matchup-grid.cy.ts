import { setupDefenseOwner, type UserSetupData } from '../../support/e2e';

// The consultation grids live in the knowledge-base "Matchups" tab. They are seeded entirely
// through the API (an officer/owner rating an attacker vs defenders and vs nodes), then read
// back through the UI. Node choices exercise the tier/path column filters:
//   - node 5  → tier 1 (range 1-18)
//   - node 25 → tier 2 (range 19-36)
//   - nodes 9/18/27/36 → path 9 (p, p+9, p+18, p+27)
// Node 5 is rated `discouraged`, so every cell in its column renders the ✕ marker.
const ATTACKER = 'Hercules';
const DEF1 = 'Doctor Doom';
const DEF2 = 'Kingpin';
const DEF3 = 'Onslaught';

interface SeededMatchups {
  ownerData: UserSetupData;
  allianceId: string;
  attackerId: string;
  def1Id: string;
  def2Id: string;
  def3Id: string;
}

function seedMatchups(prefix: string): Cypress.Chainable<SeededMatchups> {
  const pseudo = `${prefix}Own`.slice(0, 16);
  const tag = prefix.slice(0, 4).toUpperCase();
  return setupDefenseOwner(prefix, pseudo, `${prefix}All`, tag).then(({ adminData, ownerData, allianceId }) =>
    cy
      .apiLoadChampions(adminData.access_token, [
        { name: ATTACKER, cls: 'Cosmic' },
        { name: DEF1, cls: 'Mystic' },
        { name: DEF2, cls: 'Skill' },
        { name: DEF3, cls: 'Mystic' },
      ])
      .then((champs) => {
        const token = ownerData.access_token;
        const attackerId = champs[ATTACKER].id;

        // Attacker vs each defender (rows of the attacker grid).
        [DEF1, DEF2, DEF3].forEach((name) =>
          cy.apiUpsertMatchup(token, allianceId, attackerId, [
            { target_type: 'defender', defender_champion_id: champs[name].id, verdict: 'good' },
          ]),
        );

        // Attacker vs nodes (columns). Node 5 is discouraged → ✕ column.
        const nodeRatings: Array<{ node: number; verdict: 'good' | 'ok' | 'discouraged' }> = [
          { node: 5, verdict: 'discouraged' },
          { node: 25, verdict: 'good' },
          { node: 9, verdict: 'good' },
          { node: 18, verdict: 'ok' },
          { node: 27, verdict: 'good' },
          { node: 36, verdict: 'ok' },
        ];
        nodeRatings.forEach(({ node, verdict }) =>
          cy.apiUpsertMatchup(token, allianceId, attackerId, [{ target_type: 'node', node_number: node, verdict }]),
        );

        return cy.wrap<SeededMatchups>({
          ownerData,
          allianceId,
          attackerId,
          def1Id: champs[DEF1].id,
          def2Id: champs[DEF2].id,
          def3Id: champs[DEF3].id,
        });
      }),
  );
}

function openMatchupsTab(userId: string) {
  cy.apiLogin(userId);
  cy.visit('/game/knowledge-base');
  cy.getByCy('kb-tab-matchups').click();
  cy.getByCy('matchups-tab').should('be.visible');
}

function pickAttacker(name: string) {
  cy.getByCy('matchup-filter-attacker').click();
  cy.get(`[data-cy="matchup-filter-attacker-item"][data-cy-champion="${name}"]`).click();
}

function pickDefender(name: string) {
  cy.getByCy('matchup-filter-defender').click();
  cy.get(`[data-cy="matchup-filter-defender-item"][data-cy-champion="${name}"]`).click();
}

describe('Knowledge Base — matchup attacker grid', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('renders the defenders x nodes grid with score badges and a discouraged ✕', () => {
    seedMatchups('mu-atk').then(({ ownerData }) => {
      openMatchupsTab(ownerData.user_id);
      pickAttacker(ATTACKER);

      cy.getByCy('matchup-grid-container').should('be.visible');
      cy.getByCy('matchup-grid').should('be.visible');

      // One row per rated defender.
      cy.getByCy('matchup-grid').find('tbody tr').should('have.length', 3);

      // A rated non-discouraged pair renders a score badge (a span, not the ✕ icon).
      cy.get('[data-cy="matchup-grid-cell"][data-cy-node="25"]').first().find('span').should('exist');

      // The discouraged node column renders the ✕ marker (an svg icon).
      cy.get('[data-cy="matchup-grid-cell"][data-cy-node="5"]').first().find('svg').should('exist');
    });
  });

  it('opens the cell-detail dialog when a rated cell is clicked', () => {
    seedMatchups('mu-cell').then(({ ownerData, def1Id }) => {
      openMatchupsTab(ownerData.user_id);
      pickAttacker(ATTACKER);

      cy.get(`[data-cy="matchup-grid-cell"][data-cy-defender="${def1Id}"][data-cy-node="25"]`).should('exist').click();

      cy.getByCy('matchup-cell-detail').should('be.visible');
    });
  });
});

describe('Knowledge Base — matchup grid node filters', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('narrows the visible node columns when a tier is picked', () => {
    seedMatchups('mu-tier').then(({ ownerData }) => {
      openMatchupsTab(ownerData.user_id);
      pickAttacker(ATTACKER);

      // Tier-1 node 5 is present before filtering.
      cy.get('[data-cy="matchup-grid-cell"][data-cy-node="5"]').should('exist');

      // Pick "Mini boss" (tier 3, nodes 37-46): the tier-1 column disappears.
      cy.getByCy('matchup-grid-section').click();
      cy.getByCy('matchup-grid-section-3').click();

      cy.get('[data-cy="matchup-grid-cell"][data-cy-node="5"]').should('not.exist');
      cy.get('[data-cy="matchup-grid-cell"][data-cy-node="40"]').should('exist');
    });
  });

  it('shows the path filter only for tiers 1-2 / no tier, and narrows by path', () => {
    seedMatchups('mu-path').then(({ ownerData }) => {
      openMatchupsTab(ownerData.user_id);
      pickAttacker(ATTACKER);

      // No tier selected → path filter is offered.
      cy.getByCy('matchup-grid-path').should('exist');

      // Picking path 9 keeps only nodes 9/18/27/36; node 5 drops out.
      cy.getByCy('matchup-grid-path').click();
      cy.getByCy('matchup-grid-path-9').click();
      cy.get('[data-cy="matchup-grid-cell"][data-cy-node="9"]').should('exist');
      cy.get('[data-cy="matchup-grid-cell"][data-cy-node="5"]').should('not.exist');

      // Switching to "Mini boss" (tier 3) hides the path filter entirely.
      cy.getByCy('matchup-grid-section').click();
      cy.getByCy('matchup-grid-section-3').click();
      cy.getByCy('matchup-grid-path').should('not.exist');
    });
  });
});

describe('Knowledge Base — matchup defender grid (mirror)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('renders attackers x nodes when only a defender is selected', () => {
    seedMatchups('mu-def').then(({ ownerData, attackerId }) => {
      openMatchupsTab(ownerData.user_id);
      pickDefender(DEF1);

      cy.getByCy('matchup-defender-grid-container').should('be.visible');
      cy.getByCy('matchup-defender-grid').should('be.visible');

      // The rated attacker is the single row.
      cy.getByCy('matchup-defender-grid').find('tbody tr').should('have.length', 1);
      cy.get(`[data-cy="matchup-defender-grid-cell"][data-cy-attacker="${attackerId}"][data-cy-node="25"]`).should(
        'exist',
      );
    });
  });

  it('opens the cell-detail dialog when a rated cell is clicked', () => {
    seedMatchups('mu-defd').then(({ ownerData, attackerId }) => {
      openMatchupsTab(ownerData.user_id);
      pickDefender(DEF1);

      cy.get(`[data-cy="matchup-defender-grid-cell"][data-cy-attacker="${attackerId}"][data-cy-node="25"]`)
        .should('exist')
        .click();

      // Both halves of the fight: the "vs defender" side comes from the row, the "vs node" side
      // from the cell — the payload gap this dialog used to have no way to fill.
      cy.getByCy('matchup-cell-detail').should('be.visible');
      cy.getByCy('matchup-cell-detail').should('contain', ATTACKER);
      cy.getByCy('matchup-cell-detail').should('contain', DEF1);
    });
  });
});

describe('Knowledge Base — matchup node evaluation list', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('opens the cell-detail dialog when a rated row is clicked', () => {
    seedMatchups('mu-node').then(({ ownerData }) => {
      openMatchupsTab(ownerData.user_id);
      cy.getByCy('matchup-filter-node').type('25');

      cy.getByCy('matchup-evaluation-table').should('be.visible');
      cy.get('[data-cy="matchup-row"]').first().click();

      // Only a node was targeted, so the dialog opens on the node side alone.
      cy.getByCy('matchup-cell-detail').should('be.visible');
      cy.getByCy('matchup-cell-detail').should('contain', ATTACKER);
      cy.getByCy('matchup-cell-detail').should('contain', '#25');
    });
  });
});
