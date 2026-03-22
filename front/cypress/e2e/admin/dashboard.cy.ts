import '../../support/e2e';

/**
 * IMPLEMENTATION INSTRUCTIONS — Admin dashboard
 *
 * Goal:
 * - Validate `/admin/dashboard` routing and default content.
 */

describe.skip('Admin dashboard page – implementation plan', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it.skip('loads /admin/dashboard for admin user', () => {
    /**
     * Steps:
     * 1) Login as admin.
     * 2) Visit `/admin/dashboard`.
     *
     * Assertions:
     * - URL stays on `/admin/dashboard`.
     * - Dashboard shell is visible.
     */
  });

  it.skip('defaults to users tab content', () => {
    /**
     * Steps:
     * 1) Open `/admin/dashboard` as admin.
     *
     * Assertions:
     * - Users tab content is active by default.
     */
  });

  it.skip('blocks non-admin access to /admin/dashboard', () => {
    /**
     * Steps:
     * 1) Login as regular user.
     * 2) Visit `/admin/dashboard`.
     *
     * Assertions:
     * - Route is blocked/redirected.
     */
  });
});
