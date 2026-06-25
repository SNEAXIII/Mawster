import { setupAttackerScenario } from '../../support/e2e';

// Fight Not Done & Planning Error — UI integrity on the Knowledge Base page.
// Stat integrity (the /fight-records payload) is covered by the backend suite
// (api/tests/.../war_fight_record_test.py). Here we assert the UI actually
// RENDERS those values: the planning-error badge, the KO count, and that a
// fight-not-done node produces no row at all.

describe('War – FND & Planning Error: knowledge base rendering', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('planning-error node renders a row with the PE badge and the actual KO count', () => {
    setupAttackerScenario('pe-ui').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiUpdateWarKo(ownerData.access_token, allianceId, warId, 1, 10, 2);
      cy.apiTogglePlanningError(ownerData.access_token, allianceId, warId, 1, 10);
      cy.apiEndWar(ownerData.access_token, allianceId, warId);

      cy.apiLogin(ownerData.user_id);
      // These wars have no season (setupAttackerScenario creates none), so their
      // fight records are off-season. The KB defaults to the "all_seasons" filter,
      // which is season_id IS NOT NULL and would hide them — query off-season here.
      cy.visit('/game/knowledge-base?season_selector=off_season');

      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);
      cy.getByCy('fight-record-planning-error').should('be.visible');
      cy.getByCy('fight-record-ko').should('have.text', '2');
    });
  });

  it('fight-not-done node is not rendered (empty state)', () => {
    setupAttackerScenario('fnd-ui').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiUpdateWarKo(ownerData.access_token, allianceId, warId, 1, 10, 2);
      cy.apiToggleFightNotDone(ownerData.access_token, allianceId, warId, 1, 10);
      cy.apiEndWar(ownerData.access_token, allianceId, warId);

      cy.apiLogin(ownerData.user_id);
      cy.visit('/game/knowledge-base?season_selector=off_season');

      cy.getByCy('fight-records-table').should('contain.text', 'No fight records found.');
      cy.getByCy('fight-record-planning-error').should('not.exist');
    });
  });

  it('normal node renders a row with KO count and no PE badge', () => {
    setupAttackerScenario('normal-ui').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiUpdateWarKo(ownerData.access_token, allianceId, warId, 1, 10, 1);
      cy.apiEndWar(ownerData.access_token, allianceId, warId);

      cy.apiLogin(ownerData.user_id);
      cy.visit('/game/knowledge-base?season_selector=off_season');

      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);
      cy.getByCy('fight-record-ko').should('have.text', '1');
      cy.getByCy('fight-record-planning-error').should('not.exist');
    });
  });
});
