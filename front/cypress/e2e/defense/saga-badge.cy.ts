import { setupDefenseOwner } from '../../support/e2e';

describe('Defense – Saga & Ascension Badges (sagaMode defender)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  function setupAndPlaceDefender(
    prefix: string,
    champName: string,
    champClass: string,
    sagaOpts: { is_saga_attacker?: boolean; is_saga_defender?: boolean },
    ascension = 0,
  ) {
    return setupDefenseOwner(prefix, `${prefix}Plyr`, `${prefix}All`, prefix.slice(0, 3).toUpperCase()).then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, champName, champClass, { ...sagaOpts, is_ascendable: ascension > 0 }).then(
          (champs: { id: string }[]) => {
            cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3', {
              ascension,
            }).then((cu: { id: string }) => {
              cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId);

              cy.apiLogin(ownerData.user_id);
              cy.navTo('defense');
            });
          },
        );
      },
    );
  }

  it('shows saga badge on defense map when is_saga_defender (defender mode)', () => {
    setupAndPlaceDefender('def-saga-def', 'SagaDefHero', 'Mutant', { is_saga_defender: true });

    cy.getByCy('war-node-1')
      .scrollIntoView()
      .find('[data-cy="saga-badge"]')
      .should('exist');
  });

  it('does not show saga badge on defense map when only is_saga_attacker (defender mode)', () => {
    setupAndPlaceDefender('atk-only', 'SagaAtkOnly', 'Cosmic', { is_saga_attacker: true });

    cy.getByCy('war-node-1')
      .scrollIntoView()
      .find('[data-cy="saga-badge"]')
      .should('not.exist');
  });

  it('shows saga badge when both flags set (defender mode shows it)', () => {
    setupAndPlaceDefender('saga-both', 'SagaBothDef', 'Tech', {
      is_saga_attacker: true,
      is_saga_defender: true,
    });

    cy.getByCy('war-node-1')
      .scrollIntoView()
      .find('[data-cy="saga-badge"]')
      .should('exist');
  });

  it('shows ascension badge A1 on defense map node', () => {
    setupAndPlaceDefender('def-asc-a1', 'AscDefHero', 'Science', {}, 1);

    cy.getByCy('war-node-1')
      .scrollIntoView()
      .find('[data-cy="ascension-badge-1"]')
      .should('exist');
  });

  it('shows ascension badge A2 on defense map node', () => {
    setupAndPlaceDefender('def-asc-a2', 'AscDefHeroMax', 'Mystic', {}, 2);

    cy.getByCy('war-node-1')
      .scrollIntoView()
      .find('[data-cy="ascension-badge-2"]')
      .should('exist');
  });

  it('does not show ascension badge when ascension is 0', () => {
    setupAndPlaceDefender('def-asc-none', 'PlainDefHero', 'Skill', {}, 0);

    cy.getByCy('war-node-1')
      .scrollIntoView()
      .find('[data-cy="ascension-badge-1"]')
      .should('not.exist');
    cy.getByCy('war-node-1')
      .find('[data-cy="ascension-badge-2"]')
      .should('not.exist');
  });
});
