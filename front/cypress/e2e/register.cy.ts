import '../support/e2e';

/**
 * IMPLEMENTATION INSTRUCTIONS — Register
 *
 * Goal:
 * - Validate `/register` structure and sign-in trigger behavior.
 */

describe.skip('Register page – implementation plan', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it.skip('renders register card and Discord CTA', () => {
    /**
     * Steps:
     * 1) Visit `/register`.
     *
     * Assertions:
     * - Register title/subtitle are visible.
     * - Discord button is visible and enabled.
     */
  });

  it.skip('starts Discord sign-in on button click', () => {
    /**
     * Steps:
     * 1) Stub auth callback or intercept sign-in redirect.
     * 2) Click Discord CTA.
     *
     * Assertions:
     * - Sign-in flow is triggered (redirect/intercept observed).
     */
  });

  it.skip('uses callbackUrl from search params when present', () => {
    /**
     * Steps:
     * 1) Visit `/register?callbackUrl=%2Fgame%2Falliances`.
     * 2) Trigger sign-in.
     *
     * Assertions:
     * - Sign-in call carries callbackUrl `/game/alliances`.
     */
  });
});
