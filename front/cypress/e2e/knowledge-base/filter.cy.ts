import { setupKnowledgeBaseFast, setupKnowledgeBase } from '../../support/e2e';

// Column indices (0-based):
// 0: Player | 1: Attacker | 2: Defender | 3: Synergies | 4: Prefights | 5: Node | 6: Tier | 7: KO | 8: Alliance | 9: Date
//
// Dev endpoint alternates champions per node:
//   odd  nodes: attacker=Iron Man,       defender=Captain America
//   even nodes: attacker=Captain America, defender=Iron Man

describe('Knowledge Base', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('filters by player name — exact, partial lowercase, no match, clear', () => {
    const prefix = 'kb-fp';
    setupKnowledgeBaseFast(prefix).then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.visit('/game/knowledge-base');

      const pseudo = `${prefix}Own`.slice(0, 16);

      cy.getByCy('filter-player').should('be.visible').clear();
      cy.getByCy('filter-player').type(pseudo);
      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
      cy.getByCy('fight-records-table')
        .find('tbody tr')
        .each(($tr) => cy.wrap($tr).find('td').eq(0).should('have.text', pseudo));

      cy.getByCy('filter-player').should('be.visible').clear();
      cy.getByCy('filter-player').type(pseudo.toLowerCase().slice(0, 4));
      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);

      cy.getByCy('filter-player').should('be.visible').clear();
      cy.getByCy('filter-player').type('zzznomatch');
      cy.getByCy('fight-records-table').should('contain.text', 'No fight records found.');

      cy.getByCy('filter-clear').click();
      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
    });
  });

  it('filters by attacker champion — Captain America is attacker on node 2', () => {
    setupKnowledgeBaseFast('kb-fatk').then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.visit('/game/knowledge-base');

      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);

      cy.getByCy('filter-attacker').click();
      cy.get('[role="dialog"]').should('be.visible');
      cy.get('[role="dialog"]').find('input').clear();
      cy.get('[role="dialog"]').find('input').type('Captain America');
      cy.contains('[role="option"]', 'Captain America').click();
      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);

      cy.getByCy('filter-clear').click();
      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
    });
  });

  it('filters by defender champion — Iron Man is defender on node 2', () => {
    setupKnowledgeBaseFast('kb-fdef').then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.visit('/game/knowledge-base');

      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);

      cy.getByCy('filter-defender').click();
      cy.get('[role="dialog"]').should('be.visible');
      cy.get('[role="dialog"]').find('input').clear();
      cy.get('[role="dialog"]').find('input').type('Iron Man');
      cy.contains('[role="option"]', 'Iron Man').click();
      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);

      cy.getByCy('filter-clear').click();
      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
    });
  });

  it('filters by node number', () => {
    setupKnowledgeBaseFast('kb-fnode').then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.visit('/game/knowledge-base');

      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);

      cy.getByCy('filter-node').should('be.visible').clear();
      cy.getByCy('filter-node').type('1');
      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);

      cy.getByCy('filter-clear').click();
      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
    });
  });

  it('combines player and node filters', () => {
    const prefix = 'kb-fcomb';
    // setupKnowledgeBase places attackers deterministically on nodes 1 and 2,
    // avoiding the substring-match flakiness of the bulk endpoint
    setupKnowledgeBase(prefix).then(({ userData, atkData }) => {
      cy.apiLogin(userData.user_id);
      cy.visit('/game/knowledge-base');

      const attackerPseudo = `${prefix}Atk`.slice(0, 16);
      cy.getByCy('filter-player').should('be.visible').clear();
      cy.getByCy('filter-player').type(attackerPseudo);
      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);

      cy.getByCy('filter-node').should('be.visible').clear();
      cy.getByCy('filter-node').type('1');
      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);

      cy.getByCy('filter-node').should('be.visible').should('have.value', '1').clear();
      cy.getByCy('filter-node').type('50');
      cy.getByCy('fight-records-table').should('contain.text', 'No fight records found.');

      cy.getByCy('filter-clear').click();
      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
    });
  });

  it('shows empty state and resets with clear when filter matches nothing', () => {
    setupKnowledgeBaseFast('kb-fempty').then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.visit('/game/knowledge-base');

      cy.getByCy('filter-node').should('be.visible').clear();
      cy.getByCy('filter-node').type('50');
      cy.getByCy('fight-records-table').should('contain.text', 'No fight records found.');
      cy.getByCy('pagination-reset').should('not.be.disabled');

      cy.getByCy('filter-clear').click();
      cy.getByCy('fight-records-table').find('tbody tr').should('have.length.greaterThan', 0);
    });
  });
});
