import { setupKnowledgeBase } from '../../support/e2e';

// Column indices (0-based):
// 0: Player | 1: Attacker | 2: Defender | 3: Synergies | 4: Prefights | 5: Node | 6: Tier | 7: KO | 8: Alliance | 9: Date

function getColText($rows: JQuery<HTMLElement>, rowIdx: number, colIdx: number): string {
  return $rows.eq(rowIdx).find('td').eq(colIdx).text().trim();
}

describe('Knowledge Base', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  describe('Display', () => {
    it('renders all expected column headers', () => {
      setupKnowledgeBase('kb-cols').then(({ userData }) => {
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
      setupKnowledgeBase('kb-count').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
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

    it('shows synergy images for node 1 (Iron Man synergizes Captain America)', () => {
      setupKnowledgeBase('kb-syn').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        // Sort by node asc to reliably get node 1 first
        cy.contains('th', 'Node').click();
        cy.contains('th', 'Node').click();

        cy.getByCy('fight-records-table')
          .find('tbody tr')
          .first()
          .find('td')
          .eq(3) // Synergies column
          .find('img, span')
          .should('have.length.greaterThan', 0);
      });
    });

    it('shows prefight images for node 1 (Iron Man prefights node 1)', () => {
      setupKnowledgeBase('kb-pf').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        // Sort by node asc to reliably get node 1 first
        cy.contains('th', 'Node').click();
        cy.contains('th', 'Node').click();

        cy.getByCy('fight-records-table')
          .find('tbody tr')
          .first()
          .find('td')
          .eq(4) // Prefights column
          .find('img, span')
          .should('have.length.greaterThan', 0);
      });
    });

    it('node 2 has no synergies and no prefights', () => {
      setupKnowledgeBase('kb-nopf').then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        // Sort by node asc — node 1 first, node 2 last
        cy.contains('th', 'Node').click();
        cy.contains('th', 'Node').click();

        cy.getByCy('fight-records-table')
          .find('tbody tr')
          .last()
          .within(() => {
            cy.get('td').eq(3).find('img, span').should('have.length', 0);
            cy.get('td').eq(4).find('img, span').should('have.length', 0);
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
    it('filters by player name — exact, partial lowercase, no match, clear', () => {
      const prefix = 'kb-fp';
      setupKnowledgeBase(prefix).then(({ userData }) => {
        cy.apiLogin(userData.user_id);
        cy.visit('/game/knowledge-base');

        const pseudo = `${prefix}Atk`.slice(0, 16);

        cy.getByCy('filter-player').clear().type(pseudo);
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
        cy.getByCy('fight-records-table')
          .find('tbody tr')
          .each(($tr) => cy.wrap($tr).find('td').eq(0).should('have.text', pseudo));

        cy.getByCy('filter-player').clear().type(pseudo.toLowerCase().slice(0, 4));
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);

        cy.getByCy('filter-player').clear().type('zzznomatch');
        cy.getByCy('fight-records-table').should('contain.text', 'No fight records found.');

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

        cy.getByCy('filter-node').clear().type('50');
        cy.getByCy('fight-records-table').should('contain.text', 'No fight records found.');

        cy.getByCy('filter-clear').click();
        cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
      });
    });

    it('shows empty state and resets with clear when filter matches nothing', () => {
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
      setupKnowledgeBase('kb-sortnode').then(({ userData }) => {
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
