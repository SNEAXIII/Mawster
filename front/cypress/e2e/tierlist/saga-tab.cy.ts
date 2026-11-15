import { setupTierList, visitSignedOut } from '../../support/e2e';

/** The public Saga tab: the saga attackers and defenders of a regular season. */
describe('Tools – the saga tab', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  const visitSagaSignedOut = () => visitSignedOut('/tools?tab=saga');

  it('shows a saga attacker among the attackers only', () => {
    setupTierList('saga-attacker', [{ name: 'SagaAttacker', championClass: 'Tech', saga: { is_saga_attacker: true } }]);
    visitSagaSignedOut();

    cy.getByCy('saga-attackers').find('[data-cy="saga-champion-SagaAttacker"]').should('exist');
    cy.getByCy('saga-defenders').find('[data-cy="saga-champion-SagaAttacker"]').should('not.exist');
  });

  it('shows a champion with both roles in both sections', () => {
    setupTierList('saga-dual', [
      { name: 'SagaDual', championClass: 'Mutant', saga: { is_saga_attacker: true, is_saga_defender: true } },
    ]);
    visitSagaSignedOut();

    cy.getByCy('saga-attackers').find('[data-cy="saga-champion-SagaDual"]').should('exist');
    cy.getByCy('saga-defenders').find('[data-cy="saga-champion-SagaDual"]').should('exist');
  });

  it('says so when the season has no saga champion', () => {
    setupTierList('saga-empty', [{ name: 'PlainHero', championClass: 'Skill' }]).then(({ adminData }) => {
      cy.apiCreateSeason(adminData.access_token, 1);
    });
    visitSagaSignedOut();

    cy.getByCy('saga-empty').should('exist');
    cy.getByCy('saga-attackers').should('not.exist');
  });

  it('shows the saga roles of the season picked', () => {
    setupTierList('saga-switch', [
      { name: 'OldSagaHero', championClass: 'Cosmic', saga: { is_saga_attacker: true } },
    ]).then(({ adminData }) => {
      const token = adminData.access_token;
      cy.apiRequest(token, 'GET', '/admin/seasons').then((res) => {
        cy.apiCloseSeason(token, (res.body as { id: string }[])[0].id);
      });
      cy.apiCreateSeason(token, 2);
    });
    visitSagaSignedOut();

    cy.getByCy('saga-empty').should('exist');
    cy.getByCy('saga-season-select').click();
    cy.getByCy('saga-season-option-1').click();
    cy.getByCy('saga-attackers').find('[data-cy="saga-champion-OldSagaHero"]').should('exist');
    cy.getByCy('saga-empty').should('not.exist');
  });
});
