import { setupWarOwner, setupAttackerScenario } from '../../support/e2e';

describe('War tab – ELO & Tier', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Alliance card ─────────────────────────────────────────────────────────

  it('alliance card shows ELO 0 and tier 20 by default', () => {
    setupWarOwner('elo-card', 'CardOwner', 'EloCardAlliance', 'ECA').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('alliances');
      cy.getByCy('alliance-elo').should('contain.text', '0');
      cy.getByCy('alliance-tier').should('contain.text', '20');
    });
  });

  // ── War tab display ───────────────────────────────────────────────────────
  // WarTab only renders when there is an active war (activeWarId is set).
  // Use setupAttackerScenario which creates a war as part of setup.

  it('war tab shows ELO 0 and tier 20 by default', () => {
    setupAttackerScenario('elo-war').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('war-elo-value').should('have.text', '0');
      cy.getByCy('war-tier-value').should('have.text', '20');
      cy.getByCy('war-elo-edit').should('not.exist');
      cy.getByCy('war-tier-edit').should('not.exist');
    });
  });

  // ── Inline ELO edit (Alliances page only) ─────────────────────────────────

  it('officer can update ELO via inline edit', () => {
    setupWarOwner('elo-edit', 'EloEditor', 'EloEditAlliance', 'EEA').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('alliances');
      cy.getByCy('alliance-elo-edit').click();
      cy.getByCy('alliance-elo-input').clear().type('1850');
      cy.getByCy('alliance-elo-save').click();
      cy.getByCy('alliance-elo').should('contain.text', '1850');
    });
  });

  it('officer can update ELO by pressing Enter', () => {
    setupWarOwner('elo-enter', 'EloEnter', 'EloEnterAlliance', 'EEB').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('alliances');
      cy.getByCy('alliance-elo-edit').click();
      cy.getByCy('alliance-elo-input').clear().type('2100{enter}');
      cy.getByCy('alliance-elo').should('contain.text', '2100');
    });
  });

  it('Escape cancels ELO edit without saving', () => {
    setupWarOwner('elo-esc', 'EloEsc', 'EloEscAlliance', 'EEC').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('alliances');
      cy.getByCy('alliance-elo-edit').click();
      cy.getByCy('alliance-elo-input').clear().type('4000{esc}');
      cy.getByCy('alliance-elo').should('contain.text', '0');
    });
  });

  // ── Inline Tier edit (Alliances page only) ────────────────────────────────

  it('officer can update Tier via inline edit', () => {
    setupWarOwner('tier-edit', 'TierEditor', 'TierEditAlliance', 'TEA').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('alliances');
      cy.getByCy('alliance-tier-edit').click();
      cy.getByCy('alliance-tier-input').clear().type('3');
      cy.getByCy('alliance-tier-save').click();
      cy.getByCy('alliance-tier').should('contain.text', '3');
    });
  });

  it('officer can update Tier by pressing Enter', () => {
    setupWarOwner('tier-enter', 'TierEnter', 'TierEnterAlliance', 'TEB').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('alliances');
      cy.getByCy('alliance-tier-edit').click();
      cy.getByCy('alliance-tier-input').clear().type('7{enter}');
      cy.getByCy('alliance-tier').should('contain.text', '7');
    });
  });

  it('Escape cancels Tier edit without saving', () => {
    setupWarOwner('tier-esc', 'TierEsc', 'TierEscAlliance', 'TEC').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('alliances');
      cy.getByCy('alliance-tier-edit').click();
      cy.getByCy('alliance-tier-input').clear().type('5{esc}');
      cy.getByCy('alliance-tier').should('contain.text', '20');
    });
  });
});
