import { setupAllianceWithMember, setupAdmin, setupVisitorScenario } from '../../support/e2e';

describe('Alliance champion search', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Officer: filter + request rank-up ──────────────────────────────────────

  it('officer filters by champion name and requests a rank-up', () => {
    setupAllianceWithMember('cs-officer', 'Iron Man', 'Tech').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('alliances');
      cy.getByCy('tab-champion-search').click();

      cy.getByCy('roster-filter-name').type('Iron');
      cy.getByCy('champion-group-Iron Man').should('be.visible');
      cy.getByCy('champion-owner-count').should('be.visible');
      cy.getByCy('champion-owner-row').should('have.length', 1);

      cy.getByCy('champion-owner-upgrade').click();
      cy.getByCy('upgrade-rarity-select').should('be.visible');
      cy.getByCy('request-upgrade-btn').click();

      cy.contains('Upgrade request sent!').should('be.visible');
    });
  });

  // ── Visitor: read-only, no rank-up button ──────────────────────────────────

  it('visitor sees owners but no rank-up button', () => {
    setupAdmin('cs-vis-admin').then((admin) => {
      setupVisitorScenario('cs-visitor').then(({ ownerData, visitorData, ownerAccId }) => {
        cy.apiLoadChampion(admin.access_token, 'Wolverine', 'Mutant').then((champs) =>
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r1'),
        );

        cy.apiLogin(visitorData.user_id);
        cy.navTo('alliances');
        cy.getByCy('tab-champion-search').click();

        cy.getByCy('roster-filter-name').type('Wolverine');
        cy.getByCy('champion-group-Wolverine').should('be.visible');
        cy.getByCy('champion-owner-row').should('be.visible');
        cy.getByCy('champion-owner-upgrade').should('not.exist');
      });
    });
  });

  // ── Empty state: filters match nothing ─────────────────────────────────────

  it('shows empty state when filters match nothing', () => {
    setupAllianceWithMember('cs-empty', 'Doctor Doom', 'Mystic').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('alliances');
      cy.getByCy('tab-champion-search').click();

      cy.getByCy('roster-filter-name').type('Nonexistentxyz');
      cy.getByCy('champion-search-empty').should('be.visible');
      cy.getByCy('champion-group-Doctor Doom').should('not.exist');
    });
  });

  // ── Battlegroup filter: only shown with >1 group, scopes the roster ─────────

  it('filters champions by battlegroup when the alliance spans several groups', () => {
    cy.apiBatchSetup([
      { discord_token: 'cs-grp-admin', role: 'admin' },
      {
        discord_token: 'cs-grp-owner',
        game_pseudo: 'CsGrpOwner',
        create_alliance: { name: 'CsGrpAlliance', tag: 'CSG' },
        battlegroup: 1,
      },
      {
        discord_token: 'cs-grp-member',
        game_pseudo: 'CsGrpMember',
        join_alliance_token: 'cs-grp-owner',
        battlegroup: 2,
      },
    ]).then((users) => {
      const adminToken = users['cs-grp-admin'].access_token;
      const ownerToken = users['cs-grp-owner'].access_token;
      const ownerAccId = users['cs-grp-owner'].account_id!;
      const memberToken = users['cs-grp-member'].access_token;
      const memberAccId = users['cs-grp-member'].account_id!;

      // Owner (BG1) rosters Iron Man, member (BG2) rosters Wolverine.
      cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech').then((champs) =>
        cy.apiAddChampionToRoster(ownerToken, ownerAccId, champs[0].id, '7r1'),
      );
      cy.apiLoadChampion(adminToken, 'Wolverine', 'Mutant').then((champs) =>
        cy.apiAddChampionToRoster(memberToken, memberAccId, champs[0].id, '7r1'),
      );

      cy.apiLogin(users['cs-grp-owner'].user_id);
      cy.navTo('alliances');
      cy.getByCy('tab-champion-search').click();

      // No group filter: both champions listed.
      cy.getByCy('champion-group-Iron Man').should('be.visible');
      cy.getByCy('champion-group-Wolverine').should('be.visible');

      // Group 1 → only the owner's Iron Man.
      cy.getByCy('champion-search-group-select').click();
      cy.contains('Group 1').click();
      cy.getByCy('champion-group-Iron Man').should('be.visible');
      cy.getByCy('champion-group-Wolverine').should('not.exist');

      // Group 2 → only the member's Wolverine.
      cy.getByCy('champion-search-group-select').click();
      cy.contains('Group 2').click();
      cy.getByCy('champion-group-Wolverine').should('be.visible');
      cy.getByCy('champion-group-Iron Man').should('not.exist');
    });
  });

  // ── Battlegroup filter: static options, always shown ───────────────────────

  it('always shows the battlegroup selector with static group options', () => {
    setupAllianceWithMember('cs-onegrp', 'Iron Man', 'Tech').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('alliances');
      cy.getByCy('tab-champion-search').click();

      cy.getByCy('champion-group-Iron Man').should('be.visible');
      // Options are now hardcoded (BG1/BG2/BG3 + no-group), so the selector is
      // always present even when the alliance spans a single group.
      cy.getByCy('champion-search-group-select').should('be.visible');
    });
  });
});
