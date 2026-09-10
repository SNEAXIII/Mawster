import { BACKEND, setupAssignedAttacker } from '../../support/e2e';

const NODE = 10;

const nodeUrl = (allianceId: string, warId: string) =>
  `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/node/${NODE}`;
const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

const openPicker = () => cy.getByCy(`boost-trigger-node-${NODE}`).click();
const pick = (key: string) => cy.getByCy(`boost-option-${key}-node-${NODE}`).click();
const icon = (key: string) => cy.getByCy(`war-node-boost-${key}-${NODE}`);

/** The mosaic holds four cells at most: one war-exclusive boost plus the three stackable ones. */
describe('War – attacker boosts', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── The exclusive slot ────────────────────────────────────────────────────

  it('shows the picked war boost in the mosaic', () => {
    setupAssignedAttacker('boost-pick').then(({ ownerData }) => {
      cy.openWarAttackerPanel(ownerData.user_id);

      openPicker();
      pick('invulnerability');

      icon('invulnerability').should('be.visible');
    });
  });

  it('replaces the war boost instead of stacking a second one', () => {
    setupAssignedAttacker('boost-replace').then(({ ownerData }) => {
      cy.openWarAttackerPanel(ownerData.user_id);

      openPicker();
      pick('invulnerability');
      icon('invulnerability').should('exist');

      pick('regeneration');

      icon('regeneration').should('exist');
      icon('invulnerability').should('not.exist');
    });
  });

  it('clears the war boost when the active one is picked again', () => {
    setupAssignedAttacker('boost-untoggle').then(({ ownerData }) => {
      cy.openWarAttackerPanel(ownerData.user_id);

      openPicker();
      pick('power_start');
      icon('power_start').should('exist');

      pick('power_start');

      icon('power_start').should('not.exist');
    });
  });

  // ── The stackable three ───────────────────────────────────────────────────

  it('stacks the defense, power and specials boosts alongside the war boost', () => {
    setupAssignedAttacker('boost-stack').then(({ ownerData }) => {
      cy.openWarAttackerPanel(ownerData.user_id);

      openPicker();
      ['power_start', 'defense', 'power', 'specials'].forEach(pick);

      ['power_start', 'defense', 'power', 'specials'].forEach((key) => icon(key).should('exist'));
    });
  });

  // ── The API behind it ─────────────────────────────────────────────────────

  it('drops the boosts when the attacker leaves the node', () => {
    setupAssignedAttacker('boost-detach').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      const url = nodeUrl(allianceId, warId);
      const headers = authHeader(ownerData.access_token);

      cy.request({
        method: 'PUT',
        url: `${url}/boosts`,
        headers,
        body: { war_boost: 'regeneration', has_defense_boost: true },
      });
      cy.request({ method: 'DELETE', url: `${url}/attacker`, headers });

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
        url: `${nodeUrl(allianceId, warId)}/boosts`,
        headers: authHeader(ownerData.access_token),
        body: { war_boost: 'attack' },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(422);
      });
    });
  });

  it('refuses boosts on a node nobody is attacking', () => {
    setupAssignedAttacker('boost-no-attacker').then(({ ownerData, allianceId, warId }) => {
      const url = nodeUrl(allianceId, warId);
      const headers = authHeader(ownerData.access_token);

      cy.request({ method: 'DELETE', url: `${url}/attacker`, headers });
      cy.request({
        method: 'PUT',
        url: `${url}/boosts`,
        headers,
        body: { war_boost: 'power_start' },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(400);
      });
    });
  });
});
