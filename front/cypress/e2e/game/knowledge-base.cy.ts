import { setupKnowledgeBase } from '../../support/e2e';

describe('Knowledge Base', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  describe('Display', () => {
    it('renders fight records with all expected column headers', () => {
      setupKnowledgeBase('kb-cols').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        cy.getByCy('fight-records-table').should('be.visible');
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length.greaterThan', 0);

        cy.getByCy('fight-records-table').within(() => {
          cy.contains('th', 'Player').should('exist');
          cy.contains('th', 'Attacker').should('exist');
          cy.contains('th', 'Defender').should('exist');
          cy.contains('th', 'Node').should('exist');
          cy.contains('th', 'KO').should('exist');
          cy.contains('th', 'Alliance').should('exist');
          cy.contains('th', 'Date').should('exist');
        });
      });
    });

    it('shows the attacker game pseudo in the Player column for every row', () => {
      const prefix = 'kb-pseudo';
      setupKnowledgeBase(prefix).then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        const pseudo = `${prefix}Atk`.slice(0, 16);
        cy.getByCy('fight-records-table')
          .find('tbody tr')
          .each(($tr) => {
            cy.wrap($tr).find('td').eq(0).should('have.text', pseudo);
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

    it('renders 2 fight records from one completed war', () => {
      setupKnowledgeBase('kb-count').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
      });
    });

    it('shows pagination controls disabled when results fit on one page', () => {
      setupKnowledgeBase('kb-pag').then(({ userData }) => {
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
    it('filters by player name — exact, partial, case-insensitive, no match, and clear', () => {
      const prefix = 'kb-fp';
      setupKnowledgeBase(prefix).then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        const pseudo = `${prefix}Atk`.slice(0, 16);

        // Exact match
        cy.getByCy('filter-player').clear().type(pseudo);
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
        cy.getByCy('fight-records-table')
          .find('tbody tr')
          .each(($tr) => cy.wrap($tr).find('td').eq(0).should('have.text', pseudo));

        // Partial lowercase
        cy.getByCy('filter-player').clear().type(pseudo.toLowerCase().slice(0, 4));
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);

        // No match
        cy.getByCy('filter-player').clear().type('zzznomatch');
        cy.getByCy('fight-records-table').should('contain.text', 'No fight records found.');

        // Clear restores all
        cy.getByCy('filter-clear').click();
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
      });
    });

    it('filters by attacker champion', () => {
      setupKnowledgeBase('kb-fatk').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);

        cy.getByCy('filter-attacker').click();
        cy.get('[role="dialog"]').should('be.visible');
        cy.get('[role="dialog"]').find('input').clear().type('Captain America');
        cy.contains('[role="option"]', 'Captain America').click();
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);

        cy.getByCy('filter-clear').click();
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
      });
    });

    it('filters by defender champion', () => {
      setupKnowledgeBase('kb-fdef').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);

        cy.getByCy('filter-defender').click();
        cy.get('[role="dialog"]').should('be.visible');
        cy.get('[role="dialog"]').find('input').clear().type('Iron Man');
        cy.contains('[role="option"]', 'Iron Man').click();
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);

        cy.getByCy('filter-clear').click();
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
      });
    });

    it('filters by node number', () => {
      setupKnowledgeBase('kb-fnode').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);

        cy.getByCy('filter-node').clear().type('1');
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);

        cy.getByCy('filter-clear').click();
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
      });
    });

    it('combines player and node filters', () => {
      const prefix = 'kb-fcomb';
      setupKnowledgeBase(prefix).then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        const pseudo = `${prefix}Atk`.slice(0, 16);
        cy.getByCy('filter-player').clear().type(pseudo);
        cy.getByCy('filter-node').clear().type('1');
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);

        // Player matches but node doesn't
        cy.getByCy('filter-node').clear().type('50');
        cy.getByCy('fight-records-table').should('contain.text', 'No fight records found.');

        cy.getByCy('filter-clear').click();
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
      });
    });

    it('shows empty state when no record matches the filter', () => {
      setupKnowledgeBase('kb-fempty').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        cy.getByCy('filter-node').clear().type('50');
        cy.getByCy('fight-records-table').should('contain.text', 'No fight records found.');
        cy.getByCy('pagination-reset').should('not.be.disabled');

        cy.getByCy('filter-clear').click();
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length.greaterThan', 0);
      });
    });
  });

  describe('Sorting', () => {
    it('sorts by KO count descending then ascending', () => {
      setupKnowledgeBase('kb-sort').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);

        cy.contains('th', 'KO').click();
        cy.getByCy('fight-records-table').find('tbody tr').then(($rows) => {
          const kos = [...$rows].map((r) =>
            Number(r.querySelectorAll('td')[6]?.textContent?.trim() ?? '0'),
          );
          expect(kos[0]).to.be.at.least(kos[1]);
        });

        cy.contains('th', 'KO').click();
        cy.getByCy('fight-records-table').find('tbody tr').then(($rows) => {
          const kos = [...$rows].map((r) =>
            Number(r.querySelectorAll('td')[6]?.textContent?.trim() ?? '0'),
          );
          expect(kos[0]).to.be.at.most(kos[1]);
        });
      });
    });

    it('sorts by node number', () => {
      setupKnowledgeBase('kb-sortnode').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        cy.contains('th', 'Node').click();
        cy.getByCy('fight-records-table').find('tbody tr').then(($rows) => {
          const nodes = [...$rows].map((r) =>
            Number(r.querySelectorAll('td')[4]?.textContent?.trim() ?? '0'),
          );
          expect(nodes[0]).to.be.at.least(nodes[1]);
        });

        cy.contains('th', 'Node').click();
        cy.getByCy('fight-records-table').find('tbody tr').then(($rows) => {
          const nodes = [...$rows].map((r) =>
            Number(r.querySelectorAll('td')[4]?.textContent?.trim() ?? '0'),
          );
          expect(nodes[0]).to.be.at.most(nodes[1]);
        });
      });
    });
  });
});
