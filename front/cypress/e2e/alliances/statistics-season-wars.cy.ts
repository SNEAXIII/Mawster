import { addStatsForPlayer, openStatsAs, withWarScenario, withWarScenarioTwoPlayers } from './statistics-helpers';

/** Open the season war results overlay from the statistics tab. */
function openSeasonWars() {
  cy.getByCy('statistics-open-season-wars').click();
  cy.getByCy('season-wars-dialog').should('be.visible');
}

describe('Alliance Statistics – Season war results', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Table content ─────────────────────────────────────────────────────────

  it('splits a war deaths per battlegroup and totals them', () => {
    withWarScenarioTwoPlayers('stat-sw', 'MWOX', 2).then((ctx) => {
      const { ownerToken, ownerUserId, allianceId, warId, champId, cuOwnerId, cuMemberId } = ctx;

      addStatsForPlayer(ownerToken, allianceId, warId, champId, cuOwnerId, 10, 1, 1);
      addStatsForPlayer(ownerToken, allianceId, warId, champId, cuMemberId, 11, 3, 2);
      cy.apiEndWar(ownerToken, allianceId, warId, true, 10, 35);

      openStatsAs(ownerUserId);
      openSeasonWars();

      cy.getByCy(`season-war-number-${warId}`).should('contain', 'War 1');
      cy.getByCy(`season-war-opponent-${warId}`).should('contain', 'MWOX');
      cy.getByCy(`season-war-result-${warId}`).should('contain', 'WIN');
      cy.getByCy(`season-war-deaths-${warId}`).should('have.text', '4');
      cy.getByCy(`season-war-${warId}-bg1`).should('have.text', '1');
      cy.getByCy(`season-war-${warId}-bg2`).should('have.text', '3');
      cy.getByCy(`season-war-${warId}-bg3`).should('have.text', '0');
    });
  });

  it('averages over the wars played, not a fixed season length', () => {
    withWarScenario('stat-swa', 'AVGX').then((ctx) => {
      const { ownerToken, ownerUserId, allianceId, warId, champId, cuId } = ctx;

      addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 3, 1);
      cy.apiEndWar(ownerToken, allianceId, warId, true, 10, 12);

      openStatsAs(ownerUserId);
      openSeasonWars();

      cy.getByCy('season-war-total-op').should('have.text', '12');
      cy.getByCy('season-war-total-deaths').should('have.text', '3');
      cy.getByCy('season-war-average-op').should('have.text', '12.00');
      cy.getByCy('season-war-average-deaths').should('have.text', '3.00');
    });
  });

  it('leaves out a war that is still running', () => {
    withWarScenario('stat-swr', 'LIVEX').then((ctx) => {
      const { ownerToken, ownerUserId, allianceId, warId, champId, cuId } = ctx;

      addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 2, 1);

      openStatsAs(ownerUserId);
      openSeasonWars();

      cy.getByCy('season-wars-empty').should('be.visible');
      cy.getByCy(`season-war-row-${warId}`).should('not.exist');
    });
  });

  // ── Enemy deaths, entered by hand ─────────────────────────────────────────

  it('lets a strategist backfill the enemy deaths of an ended war', () => {
    withWarScenario('stat-swe', 'EDITX').then((ctx) => {
      const { ownerToken, ownerUserId, allianceId, warId, champId, cuId } = ctx;

      addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 1, 1);
      cy.apiEndWar(ownerToken, allianceId, warId, true, 10);

      openStatsAs(ownerUserId);
      openSeasonWars();

      cy.getByCy(`season-war-op-edit-${warId}`).should('contain', '—').click();
      cy.getByCy(`season-war-op-input-${warId}`).type('27{enter}');

      cy.getByCy(`season-war-op-edit-${warId}`).should('contain', '27');
      cy.getByCy('season-war-total-op').should('have.text', '27');
    });
  });

  it('accepts zero, an opponent that lost nobody', () => {
    withWarScenario('stat-swz', 'ZEROX').then((ctx) => {
      const { ownerToken, ownerUserId, allianceId, warId, champId, cuId } = ctx;

      addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 1, 1);
      cy.apiEndWar(ownerToken, allianceId, warId, true, 10);

      openStatsAs(ownerUserId);
      openSeasonWars();

      cy.getByCy(`season-war-op-edit-${warId}`).click();
      cy.getByCy(`season-war-op-input-${warId}`).type('0{enter}');

      cy.getByCy(`season-war-op-edit-${warId}`).should('contain', '0');
      cy.getByCy('season-war-total-op').should('have.text', '0');
    });
  });

  it('shows the value entered when the war was ended', () => {
    withWarScenario('stat-swi', 'ENDX').then((ctx) => {
      const { ownerToken, ownerUserId, allianceId, warId, champId, cuId } = ctx;

      addStatsForPlayer(ownerToken, allianceId, warId, champId, cuId, 10, 1, 1);
      cy.apiEndWar(ownerToken, allianceId, warId, true, 10, 8);

      openStatsAs(ownerUserId);
      openSeasonWars();

      cy.getByCy(`season-war-op-edit-${warId}`).should('contain', '8');
    });
  });

  // ── Permissions ───────────────────────────────────────────────────────────

  it('keeps the cell read-only for a plain member', () => {
    withWarScenarioTwoPlayers('stat-swp', 'PERMX').then((ctx) => {
      const { ownerToken, memberUserId, allianceId, warId, champId, cuOwnerId } = ctx;

      addStatsForPlayer(ownerToken, allianceId, warId, champId, cuOwnerId, 10, 1, 1);
      cy.apiEndWar(ownerToken, allianceId, warId, true, 10, 5);

      openStatsAs(memberUserId);
      openSeasonWars();

      cy.getByCy(`season-war-row-${warId}`).should('be.visible');
      cy.getByCy(`season-war-op-edit-${warId}`).should('not.exist');
    });
  });
});
