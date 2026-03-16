import '../../support/e2e';

/**
 * IMPLEMENTATION INSTRUCTIONS — Admin basic
 *
 * Goal:
 * - Verify route protection and base rendering for `/admin`.
 */

describe.skip('Admin page – implementation plan', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it.skip('allows admin to open /admin', () => {
    /**
     * Steps:
     * 1) Login as admin.
     * 2) Visit `/admin`.
     *
     * Assertions:
     * - URL stays on `/admin`.
     * - Main admin content is visible.
     */
  });

  it.skip('redirects non-admin away from /admin', () => {
    /**
     * Steps:
     * 1) Login as regular user.
     * 2) Visit `/admin`.
     *
     * Assertions:
     * - User is redirected to allowed route (e.g. `/profile` or `/game/alliances`).
     */
  });

  it.skip('renders admin shell and tab container', () => {
    /**
     * Steps:
     * 1) Login as admin and open `/admin`.
     *
     * Assertions:
     * - Tabs or equivalent admin navigation container is visible.
     */
  });
});
