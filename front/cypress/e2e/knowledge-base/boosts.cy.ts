import { BACKEND, setupAssignedAttacker } from '../../support/e2e';

const NODE = 10;

/**
 * The boosts must survive the war they were used in. The fast setup inserts fight records
 * directly, so these go through the real path — assign, boost, close — which is what
 * actually freezes them onto the record.
 */
describe('Knowledge Base – boosts', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  function endWarWithBoosts(prefix: string, body: Record<string, unknown>) {
    return setupAssignedAttacker(prefix).then(({ ownerData, allianceId, warId }) => {
      cy.request({
        method: 'PUT',
        url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/node/${NODE}/boosts`,
        headers: { Authorization: `Bearer ${ownerData.access_token}` },
        body,
      });
      cy.apiEndWar(ownerData.access_token, allianceId, warId, true, 10);
      cy.apiLogin(ownerData.user_id, 'knowledge-base');
      return cy.wrap(ownerData, { log: false });
    });
  }

  it('carries the boosts of a closed war onto its fight record', () => {
    endWarWithBoosts('kb-boost-freeze', {
      war_boost: 'invulnerability',
      has_defense_boost: true,
      has_specials_boost: true,
    });

    cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);
    cy.getByCy('fight-record-boosts').within(() => {
      cy.getByCy(`war-node-boost-invulnerability-${NODE}`).should('exist');
      cy.getByCy(`war-node-boost-defense-${NODE}`).should('exist');
      cy.getByCy(`war-node-boost-specials-${NODE}`).should('exist');
      cy.getByCy(`war-node-boost-power-${NODE}`).should('not.exist');
    });
  });

  it('leaves the boost cell empty for a fight fought without any', () => {
    setupAssignedAttacker('kb-boost-none').then(({ ownerData, allianceId, warId }) => {
      cy.apiEndWar(ownerData.access_token, allianceId, warId, true, 10);
      cy.apiLogin(ownerData.user_id, 'knowledge-base');

      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);
      cy.getByCy('fight-record-boosts').find('[data-cy^="war-node-boost-"]').should('have.length', 0);
    });
  });

  it('keeps the record intact after the war it came from is gone', () => {
    endWarWithBoosts('kb-boost-frozen', { war_boost: 'power_start', has_power_boost: true });

    // The record is a copy, not a join: it still reads the same on a reload.
    cy.reload();
    cy.getByCy('fight-record-boosts').within(() => {
      cy.getByCy(`war-node-boost-power_start-${NODE}`).should('exist');
      cy.getByCy(`war-node-boost-power-${NODE}`).should('exist');
    });
  });
});
