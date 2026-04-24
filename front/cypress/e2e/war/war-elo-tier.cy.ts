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
    });
  });

  // ── Inline ELO edit ───────────────────────────────────────────────────────

  it('officer can update ELO via inline edit', () => {
    setupAttackerScenario('elo-edit').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('war-elo-edit').click();
      cy.getByCy('war-elo-input').clear().type('1850');
      cy.getByCy('war-elo-save').click();
      cy.getByCy('war-elo-value').should('have.text', '1850');
    });
  });

  it('officer can update ELO by pressing Enter', () => {
    setupAttackerScenario('elo-enter').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('war-elo-edit').click();
      cy.getByCy('war-elo-input').clear().type('2100{enter}');
      cy.getByCy('war-elo-value').should('have.text', '2100');
    });
  });

  it('Escape cancels ELO edit without saving', () => {
    setupAttackerScenario('elo-esc').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('war-elo-edit').click();
      cy.getByCy('war-elo-input').clear().type('4000{esc}');
      cy.getByCy('war-elo-value').should('have.text', '0');
    });
  });

  // ── Inline Tier edit ──────────────────────────────────────────────────────

  it('officer can update Tier via inline edit', () => {
    setupAttackerScenario('tier-edit').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('war-tier-edit').click();
      cy.getByCy('war-tier-input').clear().type('3');
      cy.getByCy('war-tier-save').click();
      cy.getByCy('war-tier-value').should('have.text', '3');
    });
  });

  it('officer can update Tier by pressing Enter', () => {
    setupAttackerScenario('tier-enter').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('war-tier-edit').click();
      cy.getByCy('war-tier-input').clear().type('7{enter}');
      cy.getByCy('war-tier-value').should('have.text', '7');
    });
  });

  it('Escape cancels Tier edit without saving', () => {
    setupAttackerScenario('tier-esc').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('war');
      cy.getByCy('war-tier-edit').click();
      cy.getByCy('war-tier-input').clear().type('5{esc}');
      cy.getByCy('war-tier-value').should('have.text', '20');
    });
  });
});
