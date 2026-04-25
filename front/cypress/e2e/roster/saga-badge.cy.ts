import { setupRosterUser } from '../../support/e2e';

describe('Roster – Saga Badge (sagaMode all)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows saga badge when champion is_saga_attacker', () => {
    setupRosterUser('rst-saga-atk', 'SagaAtkPlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'SagaAttacker', 'Mutant', {
        is_saga_attacker: true,
      }).then((champs: { id: string }[]) => {
        cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r3');

        cy.apiLogin(userData.user_id);
        cy.navTo('roster');

        cy.getByCy('champion-card-SagaAttacker').find('[data-cy="saga-badge"]').should('exist');
      });
    });
  });

  it('shows saga badge when champion is_saga_defender', () => {
    setupRosterUser('rst-saga-def', 'SagaDefPlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'SagaDefender', 'Cosmic', {
        is_saga_defender: true,
      }).then((champs: { id: string }[]) => {
        cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r3');

        cy.apiLogin(userData.user_id);
        cy.navTo('roster');

        cy.getByCy('champion-card-SagaDefender').find('[data-cy="saga-badge"]').should('exist');
      });
    });
  });

  it('does not show saga badge when champion has neither flag', () => {
    setupRosterUser('rst-saga-none', 'NoSagaPlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'PlainHero', 'Tech').then((champs: { id: string }[]) => {
        cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r3');

        cy.apiLogin(userData.user_id);
        cy.navTo('roster');

        cy.getByCy('champion-card-PlainHero').find('[data-cy="saga-badge"]').should('not.exist');
      });
    });
  });

  it('shows ascension badge A1 on roster card', () => {
    setupRosterUser('rst-asc-badge', 'AscBadgePlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'AscBadgeHero', 'Science', {
        is_ascendable: true,
      }).then((champs: { id: string }[]) => {
        cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r3', {
          ascension: 1,
        });

        cy.apiLogin(userData.user_id);
        cy.navTo('roster');

        cy.getByCy('champion-card-AscBadgeHero').find('[data-cy="ascension-badge-1"]').should('exist');
      });
    });
  });
});
