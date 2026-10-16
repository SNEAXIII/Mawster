import { openWarNode, putPlanNode, setupPrefightScenario } from '../../support/e2e';

const MEMBER_FILLERS = [
  { name: 'Spider-Man', champion_class: 'Cosmic' },
  { name: 'Doctor Doom', champion_class: 'Mystic' },
  { name: 'Blade', champion_class: 'Skill' },
  { name: 'Hulk', champion_class: 'Science' },
];
const OWNER_FILLERS = [
  { name: 'Thor', champion_class: 'Cosmic' },
  { name: 'Hood', champion_class: 'Mystic' },
  { name: 'Elektra', champion_class: 'Skill' },
  { name: 'Hercules', champion_class: 'Cosmic' },
];
const toRoster = (champs: { name: string }[]) => champs.map((c) => ({ champion: c.name, rarity: '7r3' }));

/** Storm, the member's only pre-fight champion, goes on the active defense plan.
 *  Activation needs a Validated plan: both BG1 players hold 5 distinct defenders. */
function stormOnDefense(prefix: string, { assignAttacker = true } = {}) {
  return setupPrefightScenario(prefix, {
    champions: [...MEMBER_FILLERS, ...OWNER_FILLERS],
    memberRoster: toRoster(MEMBER_FILLERS),
    ownerRoster: toRoster([...OWNER_FILLERS, { name: 'Iron Man' }]),
  }).then((s) => {
    const token = s.ownerData.access_token;
    if (assignAttacker) {
      cy.apiAssignWarAttacker(s.memberData.access_token, s.allianceId, s.warId, 1, 10, s.championUserId);
    }
    const defenders = [
      s.prefightChampionUserId,
      ...MEMBER_FILLERS.map((c) => s.memberChampionUserIds[c.name]),
      ...Object.values(s.ownerChampionUserIds),
    ];
    return cy.apiCreatePlan(token, s.allianceId, 1, 'Plan 1').then((plan: { id: string }) => {
      defenders.forEach((id, i) => putPlanNode(token, s.allianceId, plan.id, i + 1, id));
      cy.apiActivatePlan(token, s.allianceId, plan.id);
      return cy.wrap(s, { log: false });
    });
  });
}

function openPrefightSelector() {
  cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
  cy.getByCy('node-actions-trigger-node-10').click();
  cy.getByCy('prefight-add-node-10').click();
  cy.getByCy('prefight-selector').should('be.visible');
}

describe('War — Unrecorded Copy', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('brings a defender as pre-fight and badges it on defense', () => {
    stormOnDefense('uc1').then((s) => {
      cy.apiLogin(s.memberData.user_id, 'war');
      openPrefightSelector();
      cy.getByCy('prefight-toggle-defenders').should('have.attr', 'data-state', 'checked');
      cy.getByCy('prefight-pick-Storm').within(() => cy.getByCy('unrecorded-badge-on_defense').should('exist'));
      cy.getByCy('prefight-pick-Storm').click();
      cy.getByCy('prefight-selector').should('not.exist');
      cy.getByCy('prefight-entry-node-10')
        .scrollIntoView()
        .within(() => cy.getByCy('unrecorded-badge-on_defense').should('exist'));
    });
  });

  it('hides defenders when the toggle is off', () => {
    stormOnDefense('uc2').then((s) => {
      cy.apiLogin(s.memberData.user_id, 'war');
      openPrefightSelector();
      cy.getByCy('prefight-pick-Storm').should('exist');
      cy.getByCy('prefight-toggle-defenders').click();
      cy.getByCy('prefight-toggle-defenders').should('have.attr', 'data-state', 'unchecked');
      cy.getByCy('prefight-pick-Storm').should('not.exist');
    });
  });

  it('brings a champion not in roster from the catalog', () => {
    setupPrefightScenario('uc3', {
      champions: [{ name: 'Magik', champion_class: 'Mystic', has_prefight: true }],
    }).then((s) => {
      cy.apiAssignWarAttacker(s.memberData.access_token, s.allianceId, s.warId, 1, 10, s.championUserId);
      cy.apiLogin(s.memberData.user_id, 'war');
      openPrefightSelector();
      cy.getByCy('prefight-toggle-catalog').click();
      cy.getByCy('prefight-pick-player-first').should('be.visible');
      cy.selectOption('prefight-player-filter', 'uc3Member');
      cy.getByCy('prefight-pick-unrecorded-Magik').click();
      cy.getByCy('prefight-selector').should('not.exist');
      cy.getByCy('prefight-entry-node-10')
        .scrollIntoView()
        .within(() => cy.getByCy('unrecorded-badge-not_in_roster').should('exist'));
    });
  });

  it('removes an unrecorded pre-fight', () => {
    stormOnDefense('uc4').then((s) => {
      cy.apiRequest(s.memberData.access_token, 'POST', `/alliances/${s.allianceId}/wars/${s.warId}/bg/1/prefight`, {
        champion_id: s.prefightChampionId,
        game_account_id: s.memberAccId,
        target_node_number: 10,
      });
      cy.apiLogin(s.memberData.user_id, 'war');
      cy.getByCy('remove-prefight-node-10').scrollIntoView().click();
      cy.getByCy('prefight-entry-node-10').should('not.exist');
    });
  });

  it('keeps defenders out of the node attacker selector', () => {
    stormOnDefense('uc5', { assignAttacker: false }).then((s) => {
      cy.goToWarMode(s.ownerData.user_id, 'attackers');
      openWarNode(10);
      cy.getByCy('war-attacker-search').should('be.visible');
      cy.get('[data-cy^="attacker-card-"]').should(($els) => {
        const names = $els.toArray().map((el) => el.dataset.cy);
        expect(names).to.include('attacker-card-Wolverine');
        expect(names).not.to.include('attacker-card-Storm');
      });
    });
  });
});
