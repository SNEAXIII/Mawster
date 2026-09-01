import { BACKEND, setupKnowledgeBaseFast, setupUser } from '../../support/e2e';

// The alliance column renders the tag (`[KBA]`), the same text as the filter's
// dropdown options — so every alliance lookup here must be scoped to
// `[role="option"]`, or it matches the table cell that comes first in the DOM.

const tagOf = (prefix: string) => `[${prefix.slice(0, 3).toUpperCase()}]`;

// Alliance A owns the fight records; the user is then invited into alliance B as a
// visitor, which is what makes the alliance filter appear at all.
function setupMemberOfAVisitorOfB(prefixA: string, prefixB: string) {
  return setupKnowledgeBaseFast(prefixA).then(({ userData: userA, accountId: accAId }) => {
    return cy
      .apiBatchSetup([
        {
          discord_token: `${prefixB}-owner`,
          game_pseudo: `${prefixB}Own`.slice(0, 16),
          create_alliance: { name: `${prefixB}Alliance`, tag: prefixB.slice(0, 3).toUpperCase() },
        },
      ])
      .then((users) => {
        const ownerBData = users[`${prefixB}-owner`];

        return cy
          .request({
            method: 'POST',
            url: `${BACKEND}/alliances/${ownerBData.alliance_id!}/invitations`,
            headers: { Authorization: `Bearer ${ownerBData.access_token}` },
            body: { game_account_id: accAId, type: 'visitor' },
          })
          .then((invResp) => {
            const invId = (invResp.body as { id: string }).id;
            return cy
              .request({
                method: 'POST',
                url: `${BACKEND}/alliances/invitations/${invId}/accept`,
                headers: { Authorization: `Bearer ${userA.access_token}` },
                body: {},
              })
              .then(() => cy.apiLogin(userA.user_id, 'knowledge-base'));
          });
      });
  });
}

describe('Knowledge Base — alliance visibility', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('user with no alliance sees error (403)', () => {
    setupUser('kbaf-noalliance').then((userData) => {
      cy.apiLogin(userData.user_id, 'knowledge-base');

      cy.getByCy('fight-records-table').should('not.exist');
      cy.contains('Failed to load fight records.').should('be.visible');
    });
  });

  it('member of 1 alliance — alliance dropdown not visible', () => {
    setupKnowledgeBaseFast('kbaf-one').then(({ userData }) => {
      cy.apiLogin(userData.user_id, 'knowledge-base');

      cy.getByCy('fight-records-table').should('be.visible');
      cy.getByCy('filter-alliance').should('not.exist');
    });
  });

  it('member of A + visitor of B — alliance dropdown visible with both', () => {
    setupMemberOfAVisitorOfB('kbafa', 'kbafb').then(() => {
      cy.getByCy('filter-alliance-trigger').should('be.visible');
      cy.getByCy('filter-alliance-trigger').click();
      cy.get('[role="listbox"]').should('be.visible');
      cy.contains('[role="option"]', tagOf('kbafa')).should('be.visible');
      cy.contains('[role="option"]', tagOf('kbafb')).should('be.visible');
    });
  });

  it('alliance filter scopes records — A records visible, B shows empty', () => {
    setupMemberOfAVisitorOfB('kbafs', 'vizbb').then(() => {
      // Filter by alliance A → records visible
      cy.selectOption('filter-alliance-trigger', tagOf('kbafs'));
      cy.getByCy('fight-records-table').find('tbody tr').should('have.length.gte', 1);

      // Clear + filter by alliance B (no records) → empty state
      cy.getByCy('filter-clear').click();
      cy.selectOption('filter-alliance-trigger', tagOf('vizbb'));
      cy.getByCy('fight-records-table').should('contain.text', 'No fight records found.');
    });
  });
});
