import { setupAdmin } from '../../support/e2e';

const CLASSES = ['Cosmic', 'Tech', 'Mutant', 'Skill', 'Science', 'Mystic'] as const;

describe('Admin — champion class chips', () => {
  let adminToken: string;

  beforeEach(() => {
    cy.truncateDb();
    setupAdmin('class-chip-admin').then(({ access_token, user_id }) => {
      adminToken = access_token;
      cy.apiLogin(user_id);
    });
  });

  it('names the class on every champion row', () => {
    cy.apiLoadChampions(adminToken, [
      { name: 'Iron Man', cls: 'Tech' },
      { name: 'Wolverine', cls: 'Mutant' },
    ]).then(() => {
      cy.goToAdminChampionsTab();

      cy.getByCy('champion-row-Iron Man').find('[data-cy="class-chip-Tech"]').should('have.text', 'Tech');
      cy.getByCy('champion-row-Wolverine').find('[data-cy="class-chip-Mutant"]').should('have.text', 'Mutant');
    });
  });

  // The artwork is served by the static container, not bundled — a 404 silently swaps
  // in the coloured dot, so assert the image survived rather than that a chip exists.
  it('renders the class artwork rather than the fallback dot', () => {
    cy.apiLoadChampions(
      adminToken,
      CLASSES.map((cls) => ({ name: `Test${cls}`, cls })),
    ).then(() => {
      cy.goToAdminChampionsTab();

      CLASSES.forEach((cls) => {
        cy.getByCy(`champion-row-Test${cls}`).within(() => {
          cy.get(`[data-cy="class-icon-${cls}"]`)
            .should('be.visible')
            .and('have.attr', 'src', `/static/icons/class-${cls.toLowerCase()}.png`)
            .and(($img) => {
              expect(($img[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0);
            });
          cy.get(`[data-cy="class-dot-${cls}"]`).should('not.exist');
        });
      });
    });
  });
});
