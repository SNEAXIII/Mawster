import '../support/e2e';

/**
 * IMPLEMENTATION INSTRUCTIONS — Landing
 *
 * Goal:
 * - Validate static rendering and responsiveness of `/`.
 *
 * Setup:
 * - `beforeEach(() => { cy.truncateDb(); })`
 * - Use `cy.visit('/')` directly.
 */

describe.skip('Landing page – implementation plan', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it.skip('renders app name and WIP badge', () => {
    /**
     * Steps:
     * 1) Visit `/`.
     *
     * Assertions:
     * - App title is visible.
     * - WIP badge is visible.
     */
  });

  it.skip('renders localized WIP description', () => {
    /**
     * Steps:
     * 1) Visit `/` in default locale.
     *
     * Assertions:
     * - WIP description text is visible.
     * - Text is non-empty and stable across refresh.
     */
  });

  it.skip('keeps layout responsive on mobile viewport', () => {
    /**
     * Steps:
     * 1) Set mobile viewport.
     * 2) Visit `/`.
     *
     * Assertions:
     * - Main block remains centered.
     * - No horizontal overflow.
     */
  });
});
