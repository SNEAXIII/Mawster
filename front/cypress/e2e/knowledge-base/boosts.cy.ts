import { BACKEND, setupAssignedAttacker } from '../../support/e2e';

const NODE = 10;

// The war these records come from belongs to no season, and the page defaults to
// `all_seasons` — which means "every season", not "everything", and drops them.
const KB_URL = '/game/knowledge-base?season_selector=all';

const icon = (key: string) => cy.getByCy(`war-node-boost-${key}-${NODE}`);

/** Assert the record landed before reading its boosts: the empty state is a row too. */
function expectOneRecord() {
  cy.getByCy('fight-record-node').should('have.length', 1).and('have.text', String(NODE));
}

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
      cy.apiLogin(ownerData.user_id, KB_URL);
    });
  }

  it('carries the boosts of a closed war onto its fight record', () => {
    endWarWithBoosts('kb-boost-freeze', {
      war_boost: 'invulnerability',
      has_defense_boost: true,
      has_specials_boost: true,
    });

    expectOneRecord();
    cy.getByCy('fight-record-boosts').within(() => {
      icon('invulnerability').should('exist');
      icon('defense').should('exist');
      icon('specials').should('exist');
      icon('power').should('not.exist');
    });
  });

  it('leaves the boost cell empty for a fight fought without any', () => {
    setupAssignedAttacker('kb-boost-none').then(({ ownerData, allianceId, warId }) => {
      cy.apiEndWar(ownerData.access_token, allianceId, warId, true, 10);
      cy.apiLogin(ownerData.user_id, KB_URL);

      expectOneRecord();
      cy.getByCy('fight-record-boosts').find('[data-cy^="war-node-boost-"]').should('have.length', 0);
    });
  });

  it('keeps the record intact after a reload', () => {
    endWarWithBoosts('kb-boost-frozen', { war_boost: 'power_start', has_power_boost: true });

    expectOneRecord();
    // The record is a copy, not a join: it still reads the same on a reload.
    cy.reload();
    expectOneRecord();
    cy.getByCy('fight-record-boosts').within(() => {
      icon('power_start').should('exist');
      icon('power').should('exist');
    });
  });
});
