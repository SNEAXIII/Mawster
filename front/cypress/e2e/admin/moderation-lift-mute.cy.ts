import { setupAdmin, setupUser } from '../../support/e2e';

const REASON = 'Spamming war notes';

describe('Admin – lift a mute', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('lifting a mute removes it from the active mutes table', () => {
    setupUser('lift-target').then((target) => {
      setupAdmin('lift-admin').then((admin) => {
        cy.apiRequest(admin.access_token, 'POST', `/admin/users/${target.user_id}/mute`, { reason: REASON });

        cy.apiLogin(admin.user_id, 'admin');
        cy.getByCy('tab-moderation').click();
        cy.getByCy('mutes-table').should('contain.text', REASON);

        cy.get('[data-cy="mute-row"]').should('have.length', 1);
        cy.getByCy('moderation-lift-mute').click();
        cy.getByCy('confirmation-dialog-confirm').click();

        cy.get('[data-cy="mutes-table"]').should('not.contain.text', REASON);
      });
    });
  });
});
