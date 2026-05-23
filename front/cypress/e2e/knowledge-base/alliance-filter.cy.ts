import { BACKEND, setupKnowledgeBaseFast, setupUser } from '../../support/e2e';

describe('Knowledge Base — alliance visibility', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('user with no alliance sees error (403)', () => {
    setupUser('kbaf-noalliance').then((userData) => {
      cy.apiLogin(userData.user_id);
      cy.visit('/game/knowledge-base');

      cy.getByCy('fight-records-table').should('not.exist');
      cy.contains('Failed to load fight records.').should('be.visible');
    });
  });

  it('member of 1 alliance — alliance dropdown not visible', () => {
    const prefix = 'kbaf-one';
    setupKnowledgeBaseFast(prefix).then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.visit('/game/knowledge-base');

      cy.getByCy('fight-records-table').should('be.visible');
      cy.getByCy('filter-alliance').should('not.exist');
    });
  });

  it('member of A + visitor of B — alliance dropdown visible with both', () => {
    const prefixA = 'kbafa';
    const prefixB = 'kbafb';

    setupKnowledgeBaseFast(prefixA).then(({ userData: userA, accountId: accAId, allianceId: allianceAId }) => {
      cy.apiBatchSetup([
        {
          discord_token: `${prefixB}-owner`,
          game_pseudo: `${prefixB}Own`.slice(0, 16),
          create_alliance: { name: `${prefixB}Alliance`, tag: prefixB.slice(0, 3).toUpperCase() },
        },
      ]).then((users) => {
        const ownerBData = users[`${prefixB}-owner`];
        const allianceBId = ownerBData.alliance_id!;

        cy.request({
          method: 'POST',
          url: `${BACKEND}/alliances/${allianceBId}/invitations`,
          headers: { Authorization: `Bearer ${ownerBData.access_token}` },
          body: { game_account_id: accAId, type: 'visitor' },
        }).then((invResp) => {
          const invId = (invResp.body as { id: string }).id;
          cy.request({
            method: 'POST',
            url: `${BACKEND}/alliances/invitations/${invId}/accept`,
            headers: { Authorization: `Bearer ${userA.access_token}` },
            body: {},
          }).then(() => {
            cy.apiLogin(userA.user_id);
            cy.visit('/game/knowledge-base');

            cy.getByCy('filter-alliance-trigger').should('be.visible');
            cy.getByCy('filter-alliance-trigger').click();
            cy.contains(`[${prefixA.slice(0, 3).toUpperCase()}]`).should('be.visible');
            cy.contains(`[${prefixB.slice(0, 3).toUpperCase()}]`).should('be.visible');
          });
        });
      });
    });
  });

  it('alliance filter scopes records — A records visible, B shows empty', () => {
    const prefixA = 'kbafs';
    const prefixB = 'kbafv';

    setupKnowledgeBaseFast(prefixA).then(({ userData: userA, accountId: accAId, allianceId: allianceAId }) => {
      cy.apiBatchSetup([
        {
          discord_token: `${prefixB}-owner`,
          game_pseudo: `${prefixB}Own`.slice(0, 16),
          create_alliance: { name: `${prefixB}Alliance`, tag: prefixB.slice(0, 3).toUpperCase() },
        },
      ]).then((users) => {
        const ownerBData = users[`${prefixB}-owner`];
        const allianceBId = ownerBData.alliance_id!;

        cy.request({
          method: 'POST',
          url: `${BACKEND}/alliances/${allianceBId}/invitations`,
          headers: { Authorization: `Bearer ${ownerBData.access_token}` },
          body: { game_account_id: accAId, type: 'visitor' },
        }).then((invResp) => {
          const invId = (invResp.body as { id: string }).id;
          cy.request({
            method: 'POST',
            url: `${BACKEND}/alliances/invitations/${invId}/accept`,
            headers: { Authorization: `Bearer ${userA.access_token}` },
            body: {},
          }).then(() => {
            cy.apiLogin(userA.user_id);
            cy.visit('/game/knowledge-base');

            // Filter by alliance A → records visible
            cy.getByCy('filter-alliance-trigger').click();
            cy.contains(`[${prefixA.slice(0, 3).toUpperCase()}]`).click();
            cy.getByCy('fight-records-table').find('tbody tr').should('have.length.gte', 1);

            // Clear + filter by alliance B (no records) → empty state
            cy.getByCy('filter-clear').click();
            cy.getByCy('filter-alliance-trigger').click();
            cy.contains(`[${prefixB.slice(0, 3).toUpperCase()}]`).click();
            cy.getByCy('fight-records-table').should('contain.text', 'No fight records found.');
          });
        });
      });
    });
  });
});
