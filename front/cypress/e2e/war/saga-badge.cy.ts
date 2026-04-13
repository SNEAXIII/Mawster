import { setupAttackerScenario } from '../../support/e2e';

describe('War – Saga & Ascension Badges (sagaMode attacker)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  function assignSagaAttacker(
    prefix: string,
    champName: string,
    champClass: string,
    sagaOpts: { is_saga_attacker?: boolean; is_saga_defender?: boolean },
    ascension = 0,
  ) {
    return setupAttackerScenario(prefix).then(
      ({ adminToken, memberData, ownerData, allianceId, memberAccId, warId }) => {
        cy.apiLoadChampion(adminToken, champName, champClass, { ...sagaOpts, is_ascendable: ascension > 0 }).then(
          (champs: { id: string }[]) => {
            cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3', {
              ascension,
            }).then((cu: { id: string }) => {
              cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, cu.id);

              cy.apiLogin(ownerData.user_id);
              cy.navTo('war');
              cy.getByCy('war-mode-attackers').click();
            });
          },
        );
      },
    );
  }

  it('shows saga badge when attacker is_saga_attacker (attacker mode)', () => {
    assignSagaAttacker('war-saga-atk', 'SagaWarAtk', 'Mutant', { is_saga_attacker: true });

    cy.getByCy('attacker-entry-node-10')
      .scrollIntoView()
      .find('[data-cy="saga-badge"]')
      .should('exist');
  });

  it('does not show saga badge when attacker is only is_saga_defender (attacker mode)', () => {
    assignSagaAttacker('war-saga-def-only', 'SagaDefOnly', 'Cosmic', { is_saga_defender: true });

    cy.getByCy('attacker-entry-node-10')
      .scrollIntoView()
      .find('[data-cy="saga-badge"]')
      .should('not.exist');
  });

  it('shows saga badge for both flags (attacker mode)', () => {
    assignSagaAttacker('war-saga-both', 'SagaBothWar', 'Tech', {
      is_saga_attacker: true,
      is_saga_defender: true,
    });

    cy.getByCy('attacker-entry-node-10')
      .scrollIntoView()
      .find('[data-cy="saga-badge"]')
      .should('exist');
  });

  it('shows ascension badge A1 on assigned attacker', () => {
    assignSagaAttacker('war-asc-a1', 'AscWarHero', 'Science', {}, 1);

    cy.getByCy('attacker-entry-node-10')
      .scrollIntoView()
      .find('[data-cy="ascension-badge-1"]')
      .should('exist');
  });

  it('shows ascension badge A2 on assigned attacker', () => {
    assignSagaAttacker('war-asc-a2', 'AscWarHeroMax', 'Mystic', {}, 2);

    cy.getByCy('attacker-entry-node-10')
      .scrollIntoView()
      .find('[data-cy="ascension-badge-2"]')
      .should('exist');
  });

  it('does not show ascension badge when ascension is 0', () => {
    assignSagaAttacker('war-asc-none', 'PlainWarHero', 'Skill', {}, 0);

    cy.getByCy('attacker-entry-node-10')
      .scrollIntoView()
      .find('[data-cy="ascension-badge-1"]')
      .should('not.exist');
    cy.getByCy('attacker-entry-node-10')
      .find('[data-cy="ascension-badge-2"]')
      .should('not.exist');
  });
});
