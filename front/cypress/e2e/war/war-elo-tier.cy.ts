import { setupWarOwner, setupAttackerScenario } from '../../support/e2e';

// ELO and Tier share one inline editor, so they share one set of tests: only the
// field, its default and the values typed into it change.
const INLINE_FIELDS = [
  { field: 'elo', label: 'ELO', initial: '0', saved: '1850', entered: '2100', discarded: '4000' },
  { field: 'tier', label: 'Tier', initial: '20', saved: '3', entered: '7', discarded: '5' },
] as const;

// The inline ELO/Tier editors only live on the Alliances page. Fixture names are
// derived from the scenario key; the DB is truncated between tests, so any stable
// derivation is unique enough.
function openAlliancesAs(scenario: string) {
  const base = scenario.replace(/[^a-z0-9]/gi, '');
  return setupWarOwner(scenario, `${base}Owner`, `${base}Alliance`, base.slice(0, 5).toUpperCase()).then(
    ({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'alliances');
    },
  );
}

function typeInlineEdit(field: 'elo' | 'tier', keys: string) {
  cy.getByCy(`alliance-${field}-edit`).click();
  cy.getByCy(`alliance-${field}-input`).clear().type(keys);
}

describe('War tab – ELO & Tier', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Alliance card ─────────────────────────────────────────────────────────

  it('alliance card shows ELO 0 and tier 20 by default', () => {
    openAlliancesAs('elo-card').then(() => {
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

  // ── Inline edit (Alliances page only) ─────────────────────────────────────

  INLINE_FIELDS.forEach(({ field, label, initial, saved, entered, discarded }) => {
    it(`officer can update ${label} via inline edit`, () => {
      openAlliancesAs(`${field}-edit`).then(() => {
        typeInlineEdit(field, saved);
        cy.getByCy(`alliance-${field}-save`).click();
        cy.getByCy(`alliance-${field}`).should('contain.text', saved);
      });
    });

    it(`officer can update ${label} by pressing Enter`, () => {
      openAlliancesAs(`${field}-enter`).then(() => {
        typeInlineEdit(field, `${entered}{enter}`);
        cy.getByCy(`alliance-${field}`).should('contain.text', entered);
      });
    });

    it(`Escape cancels ${label} edit without saving`, () => {
      openAlliancesAs(`${field}-esc`).then(() => {
        typeInlineEdit(field, `${discarded}{esc}`);
        cy.getByCy(`alliance-${field}`).should('contain.text', initial);
      });
    });
  });
});
