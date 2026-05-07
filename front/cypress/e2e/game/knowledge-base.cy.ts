import { setupKnowledgeBaseFast } from '../../support/e2e';

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

  describe('Display', () => {
    it('renders all expected column headers', () => {
      setupKnowledgeBaseFast('kb-cols').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        cy.getByCy('fight-records-table').should('be.visible');
        cy.getByCy('fight-records-table').within(() => {
          cy.contains('th', 'Player').should('exist');
          cy.contains('th', 'Attacker').should('exist');
          cy.contains('th', 'Defender').should('exist');
          cy.contains('th', 'Synergies').should('exist');
          cy.contains('th', 'Prefights').should('exist');
          cy.contains('th', 'Node').should('exist');
          cy.contains('th', 'KO').should('exist');
          cy.contains('th', 'Alliance').should('exist');
          cy.contains('th', 'Date').should('exist');
        });
      });
    });

    it('renders 2 fight records from one completed war', () => {
      setupKnowledgeBaseFast('kb-count').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
      });
    });

    it('shows the owner game pseudo in the Player column for every row', () => {
      const prefix = 'kb-pseudo';
      setupKnowledgeBaseFast(prefix).then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        const pseudo = `${prefix}Own`.slice(0, 16);
        cy.getByCy('fight-records-table')
          .find('tbody tr')
          .each(($tr) => {
            cy.wrap($tr).find('td').eq(0).should('have.text', pseudo);
          });
      });
    });

    it('nodes have no synergies and no prefights', () => {
      setupKnowledgeBaseFast('kb-nopf').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        cy.getByCy('fight-records-table')
          .find('tbody tr')
          .each(($tr) => {
            cy.wrap($tr).within(() => {
              cy.get('td').eq(3).find('img, span').should('have.length', 0);
              cy.get('td').eq(4).find('img, span').should('have.length', 0);
            });
          });
      });
    });

    it('shows empty state when alliance has no ended wars', () => {
      cy.apiBatchSetup([
        {
          discord_token: 'kb-nowar-owner',
          game_pseudo: 'NoWarOwner',
          create_alliance: { name: 'NoWarAlliance', tag: 'NWA' },
        },
      ]).then((users) => {
        cy.apiLogin(users['kb-nowar-owner'].user_id);
        cy.visit('/game/knowledge-base');
        cy.getByCy('fight-records-table').should('contain.text', 'No fight records found.');
      });
    });

    it('shows pagination controls disabled on single page', () => {
      setupKnowledgeBaseFast('kb-pag').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        cy.getByCy('pagination-page-info').should('contain.text', 'Page 1/');
        cy.getByCy('pagination-first').should('be.disabled');
        cy.getByCy('pagination-prev').should('be.disabled');
        cy.getByCy('pagination-next').should('be.disabled');
        cy.getByCy('pagination-last').should('be.disabled');
      });
    });
  });

  describe('Filters', () => {
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
      setupKnowledgeBaseFast(prefix).then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        const pseudo = `${prefix}Own`.slice(0, 16);
        cy.getByCy('filter-player').should('be.visible').clear();
        cy.getByCy('filter-player').type(pseudo);
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
        cy.getByCy('filter-node').should('be.visible').clear();
        cy.getByCy('filter-node').type('1');
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);

        cy.getByCy('filter-node').should('have.value', '1');
        cy.getByCy('filter-node').clear();
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

  describe('Sorting', () => {
    it('sorts by KO count descending then ascending', () => {
      setupKnowledgeBaseFast('kb-sort').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);

        cy.contains('th', 'KO').click();
        cy.getByCy('fight-records-table').find('tbody tr').then(($rows) => {
          const kos = [...$rows].map((r) =>
            Number(r.querySelectorAll('td')[7]?.textContent?.trim() ?? '0'),
          );
          expect(kos[0]).to.be.at.least(kos[1]);
        });

        cy.contains('th', 'KO').click();
        cy.getByCy('fight-records-table').find('tbody tr').then(($rows) => {
          const kos = [...$rows].map((r) =>
            Number(r.querySelectorAll('td')[7]?.textContent?.trim() ?? '0'),
          );
          expect(kos[0]).to.be.at.most(kos[1]);
        });
      });
    });

    it('sorts by node number descending then ascending', () => {
      setupKnowledgeBaseFast('kb-sortnode').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        cy.contains('th', 'Node').click();
        cy.getByCy('fight-records-table').find('tbody tr').then(($rows) => {
          const nodes = [...$rows].map((r) =>
            Number(r.querySelectorAll('td')[5]?.textContent?.trim() ?? '0'),
          );
          expect(nodes[0]).to.be.at.least(nodes[1]);
        });

        cy.contains('th', 'Node').click();
        cy.getByCy('fight-records-table').find('tbody tr').then(($rows) => {
          const nodes = [...$rows].map((r) =>
            Number(r.querySelectorAll('td')[5]?.textContent?.trim() ?? '0'),
          );
          expect(nodes[0]).to.be.at.most(nodes[1]);
        });
      });
    });
  });
});
