import '../../support/e2e';

/**
 * IMPLEMENTATION INSTRUCTIONS — Admin champions
 *
 * Goal:
 * - Validate `/admin/champions` access and default champions management view.
 */

describe.skip('Admin champions page – implementation plan', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it.skip('loads /admin/champions for admin user', () => {
    /**
     * Steps:
     * 1) Login as admin.
     * 2) Visit `/admin/champions`.
     *
     * Assertions:
     * - URL stays on `/admin/champions`.
     * - Champions admin section is visible.
     */
  });

  it.skip('shows champions admin tab content by default', () => {
    /**
     * Steps:
     * 1) Open `/admin/champions` as admin.
     *
     * Assertions:
     * - Champions tab content is active by default.
     */
  });

  it.skip('blocks non-admin access to /admin/champions', () => {
    /**
     * Steps:
     * 1) Login as regular user.
     * 2) Visit `/admin/champions`.
     *
     * Assertions:
     * - Route is blocked/redirected.
     */
  });
});
