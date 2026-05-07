import { setupAttackerScenario, BACKEND } from '../../support/e2e';

describe('War – Fight Not Done & Planning Error: stat integrity (API only)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Fight Not Done ────────────────────────────────────────────────────────

  it('fight-not-done node is excluded from fight records on war end', () => {
    setupAttackerScenario('fnd-stat-excl').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiUpdateWarKo(ownerData.access_token, allianceId, warId, 1, 10, 2);
      cy.apiToggleFightNotDone(ownerData.access_token, allianceId, warId, 1, 10);
      cy.apiEndWar(ownerData.access_token, allianceId, warId);

      cy.request({
        method: 'GET',
        url: `${BACKEND}/fight-records`,
        headers: { Authorization: `Bearer ${ownerData.access_token}` },
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.total).to.eq(0);
      });
    });
  });

  it('toggling fight-not-done off then ending war includes the node in fight records', () => {
    setupAttackerScenario('fnd-stat-revert').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiUpdateWarKo(ownerData.access_token, allianceId, warId, 1, 10, 1);
      cy.apiToggleFightNotDone(ownerData.access_token, allianceId, warId, 1, 10);
      cy.apiToggleFightNotDone(ownerData.access_token, allianceId, warId, 1, 10);
      cy.apiEndWar(ownerData.access_token, allianceId, warId);

      cy.request({
        method: 'GET',
        url: `${BACKEND}/fight-records`,
        headers: { Authorization: `Bearer ${ownerData.access_token}` },
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.total).to.eq(1);
        expect(res.body.items[0].ko_count).to.eq(1);
        expect(res.body.items[0].is_planning_error).to.eq(false);
      });
    });
  });

  // ── Planning Error ────────────────────────────────────────────────────────

  it('planning-error node is included in fight records with is_planning_error=true and actual ko_count', () => {
    setupAttackerScenario('pe-stat-incl').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiUpdateWarKo(ownerData.access_token, allianceId, warId, 1, 10, 2);
      cy.apiTogglePlanningError(ownerData.access_token, allianceId, warId, 1, 10);
      cy.apiEndWar(ownerData.access_token, allianceId, warId);

      cy.request({
        method: 'GET',
        url: `${BACKEND}/fight-records`,
        headers: { Authorization: `Bearer ${ownerData.access_token}` },
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.total).to.eq(1);
        expect(res.body.items[0].is_planning_error).to.eq(true);
        expect(res.body.items[0].ko_count).to.eq(2);
      });
    });
  });

  it('toggling planning-error off then ending war produces a normal fight record', () => {
    setupAttackerScenario('pe-stat-revert').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiUpdateWarKo(ownerData.access_token, allianceId, warId, 1, 10, 3);
      cy.apiTogglePlanningError(ownerData.access_token, allianceId, warId, 1, 10);
      cy.apiTogglePlanningError(ownerData.access_token, allianceId, warId, 1, 10);
      cy.apiEndWar(ownerData.access_token, allianceId, warId);

      cy.request({
        method: 'GET',
        url: `${BACKEND}/fight-records`,
        headers: { Authorization: `Bearer ${ownerData.access_token}` },
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.total).to.eq(1);
        expect(res.body.items[0].is_planning_error).to.eq(false);
        expect(res.body.items[0].ko_count).to.eq(3);
      });
    });
  });

  // ── Baseline ──────────────────────────────────────────────────────────────

  it('normal fight node produces a fight record with actual ko_count', () => {
    setupAttackerScenario('normal-stat').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiUpdateWarKo(ownerData.access_token, allianceId, warId, 1, 10, 1);
      cy.apiEndWar(ownerData.access_token, allianceId, warId);

      cy.request({
        method: 'GET',
        url: `${BACKEND}/fight-records`,
        headers: { Authorization: `Bearer ${ownerData.access_token}` },
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.total).to.eq(1);
        expect(res.body.items[0].is_planning_error).to.eq(false);
        expect(res.body.items[0].ko_count).to.eq(1);
      });
    });
  });
});
