import { setupKnowledgeBaseFast, setupKnowledgeBase } from '../../support/e2e';

// Dev endpoint alternates champions per node:
//   odd  nodes: attacker=Iron Man,       defender=Captain America
//   even nodes: attacker=Captain America, defender=Iron Man

describe('Knowledge Base', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('renders all expected column headers', () => {
    setupKnowledgeBaseFast('kb-cols').then(({ userData }) => {
      cy.apiLogin(userData.user_id, 'knowledge-base');

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
        cy.contains('th', 'Season').should('exist');
        cy.contains('th', 'Date').should('exist');
      });
    });
  });

  it('renders 2 fight records from one completed war', () => {
    setupKnowledgeBaseFast('kb-count').then(({ userData }) => {
      cy.apiLogin(userData.user_id, 'knowledge-base');
      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
    });
  });

  it('shows the owner game pseudo in the Player column for every row', () => {
    const prefix = 'kb-pseudo';
    setupKnowledgeBaseFast(prefix).then(({ userData }) => {
      cy.apiLogin(userData.user_id, 'knowledge-base');

      const pseudo = `${prefix}Own`.slice(0, 16);
      cy.getByCy('fight-records-table')
        .find('tbody tr')
        .each(($tr) => {
          cy.wrap($tr).find('[data-cy="fight-record-player"]').should('have.text', pseudo);
        });
    });
  });

  it('nodes have no synergies and no prefights', () => {
    setupKnowledgeBaseFast('kb-nopf').then(({ userData }) => {
      cy.apiLogin(userData.user_id, 'knowledge-base');

      cy.getByCy('fight-records-table')
        .find('tbody tr')
        .each(($tr) => {
          cy.wrap($tr).within(() => {
            cy.getByCy('fight-record-synergies').find('img, span').should('have.length', 0);
            cy.getByCy('fight-record-prefights').find('img, span').should('have.length', 0);
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
      cy.apiLogin(users['kb-nowar-owner'].user_id, 'knowledge-base');
      cy.getByCy('fight-records-table').should('contain.text', 'No fight records found.');
    });
  });

  it('shows pagination controls disabled on single page', () => {
    setupKnowledgeBaseFast('kb-pag').then(({ userData }) => {
      cy.apiLogin(userData.user_id, 'knowledge-base');

      cy.getByCy('pagination-page-info').should('contain.text', 'Page 1/');
      cy.getByCy('pagination-first').should('be.disabled');
      cy.getByCy('pagination-prev').should('be.disabled');
      cy.getByCy('pagination-next').should('be.disabled');
      cy.getByCy('pagination-last').should('be.disabled');
    });
  });
});
