import { BACKEND, setupAssignedAttacker } from '../../support/e2e';

const NODE = 10;

/** The mosaic holds four cells at most: one war-exclusive boost plus the three stackable ones. */
describe('War – attacker boosts', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── The exclusive slot ────────────────────────────────────────────────────

  it('shows the picked war boost in the mosaic', () => {
    setupAssignedAttacker('boost-pick').then(({ ownerData }) => {
      cy.openWarAttackerPanel(ownerData.user_id);

      cy.getByCy(`boost-trigger-node-${NODE}`).click();
      cy.getByCy(`boost-option-invulnerability-node-${NODE}`).click();

      cy.getByCy(`war-node-boost-invulnerability-${NODE}`).should('be.visible');
    });
  });

  it('replaces the war boost instead of stacking a second one', () => {
    setupAssignedAttacker('boost-replace').then(({ ownerData }) => {
      cy.openWarAttackerPanel(ownerData.user_id);

      cy.getByCy(`boost-trigger-node-${NODE}`).click();
      cy.getByCy(`boost-option-invulnerability-node-${NODE}`).click();
      cy.getByCy(`war-node-boost-invulnerability-${NODE}`).should('exist');

      cy.getByCy(`boost-option-regeneration-node-${NODE}`).click();

      cy.getByCy(`war-node-boost-regeneration-${NODE}`).should('exist');
      cy.getByCy(`war-node-boost-invulnerability-${NODE}`).should('not.exist');
    });
  });

  it('clears the war boost when the active one is picked again', () => {
    setupAssignedAttacker('boost-untoggle').then(({ ownerData }) => {
      cy.openWarAttackerPanel(ownerData.user_id);

      cy.getByCy(`boost-trigger-node-${NODE}`).click();
      cy.getByCy(`boost-option-power_start-node-${NODE}`).click();
      cy.getByCy(`war-node-boost-power_start-${NODE}`).should('exist');

      cy.getByCy(`boost-option-power_start-node-${NODE}`).click();

      cy.getByCy(`war-node-boost-power_start-${NODE}`).should('not.exist');
    });
  });

  // ── The stackable three ───────────────────────────────────────────────────

  it('stacks the defense, power and specials boosts alongside the war boost', () => {
    setupAssignedAttacker('boost-stack').then(({ ownerData }) => {
      cy.openWarAttackerPanel(ownerData.user_id);

      cy.getByCy(`boost-trigger-node-${NODE}`).click();
      cy.getByCy(`boost-option-power_start-node-${NODE}`).click();
      cy.getByCy(`boost-option-defense-node-${NODE}`).click();
      cy.getByCy(`boost-option-power-node-${NODE}`).click();
      cy.getByCy(`boost-option-specials-node-${NODE}`).click();

      cy.getByCy(`war-node-boost-power_start-${NODE}`).should('exist');
      cy.getByCy(`war-node-boost-defense-${NODE}`).should('exist');
      cy.getByCy(`war-node-boost-power-${NODE}`).should('exist');
      cy.getByCy(`war-node-boost-specials-${NODE}`).should('exist');
    });
  });

  // ── The API behind it ─────────────────────────────────────────────────────

  it('drops the boosts when the attacker leaves the node', () => {
    setupAssignedAttacker('boost-detach').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      const auth = { Authorization: `Bearer ${ownerData.access_token}` };
      const node = `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/node/${NODE}`;

      cy.request({
        method: 'PUT',
        url: `${node}/boosts`,
        headers: auth,
        body: { war_boost: 'regeneration', has_defense_boost: true },
      });
      cy.request({ method: 'DELETE', url: `${node}/attacker`, headers: auth });

      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, NODE, championUserId);
      cy.openWarAttackerPanel(ownerData.user_id);

      cy.getByCy(`boost-trigger-node-${NODE}`).should('be.visible');
      cy.getByCy(`war-node-boosts-${NODE}`).should('not.exist');
    });
  });

  it('refuses a boost the game does not have', () => {
    setupAssignedAttacker('boost-unknown').then(({ ownerData, allianceId, warId }) => {
      cy.request({
        method: 'PUT',
        url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/node/${NODE}/boosts`,
        headers: { Authorization: `Bearer ${ownerData.access_token}` },
        body: { war_boost: 'attack' },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(422);
      });
    });
  });

  it('refuses boosts on a node nobody is attacking', () => {
    setupAssignedAttacker('boost-no-attacker').then(({ ownerData, allianceId, warId }) => {
      const node = `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/node/${NODE}`;
      const auth = { Authorization: `Bearer ${ownerData.access_token}` };

      cy.request({ method: 'DELETE', url: `${node}/attacker`, headers: auth });
      cy.request({
        method: 'PUT',
        url: `${node}/boosts`,
        headers: auth,
        body: { war_boost: 'power_start' },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(400);
      });
    });
  });
});
