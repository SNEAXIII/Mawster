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
});
