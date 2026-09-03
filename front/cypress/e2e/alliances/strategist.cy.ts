import { BACKEND, setupOwnerMemberAlliance } from '../../support/e2e';

/**
 * The Strategist rank, end to end.
 *
 * Scope: the rank's management surface — who may grant it, who may revoke it,
 * and who may see those controls at all. The placement capability the rank
 * exists to grant (Defense Assignment writes and war-map defender entry) is
 * covered by the backend integration suite, which asserts both the positive
 * path for a bare strategist and the 403 for a plain member on each of the six
 * swapped guards.
 *
 * Every assertion below is written so that it fails if the permission
 * predicate behind it is wrong, not merely if the page fails to render.
 */

/**
 * Open one member's actions dropdown. Scoped through the alliance card because
 * a pseudo identifies a row within an alliance, not within the page.
 */
function openMemberMenu(alliance: string, pseudo: string) {
  cy.getByCy(`alliance-card-${alliance}`)
    .should('be.visible')
    .within(() => {
      cy.getByCy(`member-actions-${pseudo}`).click();
    });
}

/**
 * Assert which of the two strategist entries the currently open menu offers.
 *
 * Only meaningful once `openMemberMenu` has run: Radix keeps
 * `DropdownMenuContent` unmounted until its trigger is clicked, so asserting
 * `not.exist` on a closed menu would pass however open the permission gate is.
 */
function expectStrategistEntries(pseudo: string, offered: { promote: boolean; demote: boolean }) {
  cy.getByCy(`promote-strategist-${pseudo}`).should(offered.promote ? 'be.visible' : 'not.exist');
  cy.getByCy(`demote-strategist-${pseudo}`).should(offered.demote ? 'be.visible' : 'not.exist');
}

/**
 * Assert a viewer gets no actions at all on a row — the trigger itself is never
 * rendered. Unlike an unopened menu's contents, a missing trigger is a real
 * assertion about the permission predicates.
 */
function expectNoMemberMenu(alliance: string, pseudo: string) {
  cy.getByCy(`alliance-card-${alliance}`).within(() => {
    cy.getByCy(`member-actions-${pseudo}`).should('not.exist');
  });
}

describe('Alliance strategist rank', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('owner promotes a member to strategist, then demotes them back', () => {
    setupOwnerMemberAlliance('strat-promote', 'StratOwner', 'StratMember', 'StratAlliance', 'STR').then(
      ({ ownerData }) => {
        cy.apiLogin(ownerData.user_id, 'alliances');

        openMemberMenu('StratAlliance', 'StratMember');
        expectStrategistEntries('StratMember', { promote: true, demote: false });

        // The entry acts immediately — there is deliberately no confirmation
        // dialog on this rank, unlike promotion to officer.
        cy.getByCy('promote-strategist-StratMember').click();

        // The menu flips. Both entries are driven by `member.is_strategist`,
        // and the component refetches the alliance after acting, so this
        // exercises the read path end to end: the row written by the POST comes
        // back through GET /alliances.
        openMemberMenu('StratAlliance', 'StratMember');
        expectStrategistEntries('StratMember', { promote: false, demote: true });

        cy.getByCy('demote-strategist-StratMember').click();

        openMemberMenu('StratAlliance', 'StratMember');
        expectStrategistEntries('StratMember', { promote: true, demote: false });
      },
    );
  });

  it('an officer may grant the strategist rank but not the officer rank', () => {
    // The two promotions have deliberately different gates: granting the
    // strategist rank is delegation, which an officer may do, while promoting
    // to officer is the owner's alone. This pins both halves in one view.
    const prefix = 'strat-gate';
    const ownerToken = `${prefix}-owner`;
    const officerToken = `${prefix}-officer`;
    const plainToken = `${prefix}-plain`;

    cy.apiBatchSetup([
      {
        discord_token: ownerToken,
        game_pseudo: 'GateOwner',
        create_alliance: { name: 'GateAlliance', tag: 'GAT' },
      },
      { discord_token: officerToken, game_pseudo: 'GateOfficer', join_alliance_token: ownerToken },
      { discord_token: plainToken, game_pseudo: 'GatePlain', join_alliance_token: ownerToken },
    ]).then((users) => {
      const allianceId = users[ownerToken].alliance_id!;

      cy.apiAddOfficer(users[ownerToken].access_token, allianceId, users[officerToken].account_id!);
      cy.apiLogin(users[officerToken].user_id, 'alliances');

      openMemberMenu('GateAlliance', 'GatePlain');

      // The officer may delegate placement…
      expectStrategistEntries('GatePlain', { promote: true, demote: false });
      // …but may not create a peer. That entry belongs to the owner alone.
      cy.getByCy('promote-officer-GatePlain').should('not.exist');
    });
  });

  it('a plain member sees no strategist controls at all', () => {
    // The negative case. Without it, every assertion above would pass just as
    // well against a dropdown that offered the promotion to everyone.
    setupOwnerMemberAlliance('strat-deny', 'DenyOwner', 'DenyMember', 'DenyAlliance', 'DNY').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id, 'alliances');

      openMemberMenu('DenyAlliance', 'DenyMember');
      // Leave is the one entry a plain member does get: it proves the menu
      // actually opened, so the absences below mean something.
      cy.getByCy('leave-alliance-DenyMember').should('be.visible');
      expectStrategistEntries('DenyMember', { promote: false, demote: false });

      expectNoMemberMenu('DenyAlliance', 'DenyOwner');
    });
  });

  it('a strategist has placement rights and no authority over people', () => {
    // If the rank ever leaked `can_manage`, this is the test that catches it.
    setupOwnerMemberAlliance('strat-noprom', 'NoPromOwner', 'NoPromStrat', 'NoPromAlliance', 'NPR').then(
      ({ ownerData, memberData, allianceId, memberAccId }) => {
        cy.apiAddStrategist(ownerData.access_token, allianceId, memberAccId);
        cy.apiLogin(memberData.user_id, 'alliances');

        openMemberMenu('NoPromAlliance', 'NoPromStrat');
        cy.getByCy('leave-alliance-NoPromStrat').should('be.visible');
        expectStrategistEntries('NoPromStrat', { promote: false, demote: false });

        expectNoMemberMenu('NoPromAlliance', 'NoPromOwner');

        // And the API refuses their token outright, so the UI gate is not the
        // only thing standing between a strategist and a promotion. This half
        // bites for the right reason: `require_officer` runs before
        // `add_strategist`'s already-a-strategist 409, so a guard swapped to
        // `require_strategist` would return 409 here, not 403.
        cy.request({
          method: 'POST',
          url: `${BACKEND}/alliances/${allianceId}/strategists`,
          headers: { Authorization: `Bearer ${memberData.access_token}` },
          body: { game_account_id: memberAccId },
          failOnStatusCode: false,
        })
          .its('status')
          .should('eq', 403);
      },
    );
  });
});
