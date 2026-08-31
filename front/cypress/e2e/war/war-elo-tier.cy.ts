import { setupWarOwner, setupAttackerScenario } from '../../support/e2e';

describe('War tab – ELO & Tier', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // The inline ELO/Tier editors only live on the Alliances page.
  function openAlliancesAs(prefix: string, pseudo: string, allianceName: string, tag: string) {
    return setupWarOwner(prefix, pseudo, allianceName, tag).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'alliances');
    });
  }

  function typeInlineEdit(field: 'elo' | 'tier', keys: string) {
    cy.getByCy(`alliance-${field}-edit`).click();
    cy.getByCy(`alliance-${field}-input`).clear().type(keys);
  }

  // ── Alliance card ─────────────────────────────────────────────────────────

  it('alliance card shows ELO 0 and tier 20 by default', () => {
    openAlliancesAs('elo-card', 'CardOwner', 'EloCardAlliance', 'ECA').then(() => {
      cy.getByCy('alliance-elo').should('contain.text', '0');
      cy.getByCy('alliance-tier').should('contain.text', '20');
    });
  });

  // ── War tab display ───────────────────────────────────────────────────────
  // WarTab only renders when there is an active war (activeWarId is set).
  // Use setupAttackerScenario which creates a war as part of setup.

  it('war tab shows ELO 0 and tier 20 by default', () => {
    setupAttackerScenario('elo-war').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'war');
      cy.getByCy('war-elo-value').should('have.text', '0');
      cy.getByCy('war-tier-value').should('have.text', '20');
      cy.getByCy('war-elo-edit').should('not.exist');
      cy.getByCy('war-tier-edit').should('not.exist');
    });
  });

  // ── Inline ELO edit (Alliances page only) ─────────────────────────────────

  it('officer can update ELO via inline edit', () => {
    openAlliancesAs('elo-edit', 'EloEditor', 'EloEditAlliance', 'EEA').then(() => {
      typeInlineEdit('elo', '1850');
      cy.getByCy('alliance-elo-save').click();
      cy.getByCy('alliance-elo').should('contain.text', '1850');
    });
  });

  it('officer can update ELO by pressing Enter', () => {
    openAlliancesAs('elo-enter', 'EloEnter', 'EloEnterAlliance', 'EEB').then(() => {
      typeInlineEdit('elo', '2100{enter}');
      cy.getByCy('alliance-elo').should('contain.text', '2100');
    });
  });

  it('Escape cancels ELO edit without saving', () => {
    openAlliancesAs('elo-esc', 'EloEsc', 'EloEscAlliance', 'EEC').then(() => {
      typeInlineEdit('elo', '4000{esc}');
      cy.getByCy('alliance-elo').should('contain.text', '0');
    });
  });

  // ── Inline Tier edit (Alliances page only) ────────────────────────────────

  it('officer can update Tier via inline edit', () => {
    openAlliancesAs('tier-edit', 'TierEditor', 'TierEditAlliance', 'TEA').then(() => {
      typeInlineEdit('tier', '3');
      cy.getByCy('alliance-tier-save').click();
      cy.getByCy('alliance-tier').should('contain.text', '3');
    });
  });

  it('officer can update Tier by pressing Enter', () => {
    openAlliancesAs('tier-enter', 'TierEnter', 'TierEnterAlliance', 'TEB').then(() => {
      typeInlineEdit('tier', '7{enter}');
      cy.getByCy('alliance-tier').should('contain.text', '7');
    });
  });

  it('Escape cancels Tier edit without saving', () => {
    openAlliancesAs('tier-esc', 'TierEsc', 'TierEscAlliance', 'TEC').then(() => {
      typeInlineEdit('tier', '5{esc}');
      cy.getByCy('alliance-tier').should('contain.text', '20');
    });
  });
});
