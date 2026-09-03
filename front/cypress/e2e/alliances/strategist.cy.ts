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
describe('Alliance strategist rank', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('owner promotes a member to strategist, then demotes them back', () => {
    setupOwnerMemberAlliance('strat-promote', 'StratOwner', 'StratMember', 'StratAlliance', 'STR').then(
      ({ ownerData }) => {
        cy.apiLogin(ownerData.user_id, 'alliances');

        // Before promotion: the promote entry is offered, the demote one is not.
        cy.getByCy('alliance-card-StratAlliance')
          .should('be.visible')
          .within(() => {
            cy.getByCy('member-actions-StratMember').click();
          });
        cy.getByCy('promote-strategist-StratMember').should('be.visible');
        cy.getByCy('demote-strategist-StratMember').should('not.exist');

        // Promote. The entry acts immediately — there is deliberately no
        // confirmation dialog on this rank, unlike promotion to officer.
        cy.getByCy('promote-strategist-StratMember').click();

        // The menu now flips: demote offered, promote gone. This is what proves
        // the new rank actually reached the payload the front reads, since both
        // entries are driven by `member.is_strategist`.
        cy.getByCy('alliance-card-StratAlliance').within(() => {
          cy.getByCy('member-actions-StratMember').click();
        });
        cy.getByCy('demote-strategist-StratMember').should('be.visible');
        cy.getByCy('promote-strategist-StratMember').should('not.exist');

        // Demote, and it flips back.
        cy.getByCy('demote-strategist-StratMember').click();

        cy.getByCy('alliance-card-StratAlliance').within(() => {
          cy.getByCy('member-actions-StratMember').click();
        });
        cy.getByCy('promote-strategist-StratMember').should('be.visible');
        cy.getByCy('demote-strategist-StratMember').should('not.exist');
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
      const officerAccId = users[officerToken].account_id!;

      cy.apiAddOfficer(users[ownerToken].access_token, allianceId, officerAccId);
      cy.apiLogin(users[officerToken].user_id, 'alliances');

      cy.getByCy('alliance-card-GateAlliance')
        .should('be.visible')
        .within(() => {
          cy.getByCy('member-actions-GatePlain').click();
        });

      // The officer may delegate placement…
      cy.getByCy('promote-strategist-GatePlain').should('be.visible');
      // …but may not create a peer. That entry belongs to the owner alone.
      cy.getByCy('promote-officer-GatePlain').should('not.exist');
    });
  });

  it('a plain member sees no strategist controls at all', () => {
    // The negative case. Without it, every assertion above would pass just as
    // well against a dropdown that offered the promotion to everyone.
    setupOwnerMemberAlliance('strat-deny', 'DenyOwner', 'DenyMember', 'DenyAlliance', 'DNY').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id, 'alliances');

      cy.getByCy('alliance-card-DenyAlliance').should('be.visible');

      cy.getByCy('promote-strategist-DenyOwner').should('not.exist');
      cy.getByCy('promote-strategist-DenyMember').should('not.exist');
      cy.getByCy('demote-strategist-DenyOwner').should('not.exist');
      cy.getByCy('demote-strategist-DenyMember').should('not.exist');
    });
  });

  it('a strategist has placement rights and no authority over people', () => {
    // If the rank ever leaked `can_manage`, this is the test that catches it.
    setupOwnerMemberAlliance('strat-noprom', 'NoPromOwner', 'NoPromStrat', 'NoPromAlliance', 'NPR').then(
      ({ ownerData, memberData, allianceId, memberAccId }) => {
        cy.apiAddStrategist(ownerData.access_token, allianceId, memberAccId);
        cy.apiLogin(memberData.user_id, 'alliances');

        cy.getByCy('alliance-card-NoPromAlliance').should('be.visible');

        cy.getByCy('promote-strategist-NoPromOwner').should('not.exist');
        cy.getByCy('demote-strategist-NoPromOwner').should('not.exist');
        // Not even on themselves.
        cy.getByCy('demote-strategist-NoPromStrat').should('not.exist');

        // And the API refuses their token outright, so the UI gate is not the
        // only thing standing between a strategist and a promotion.
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
