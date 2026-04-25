import { setupDefenseOwner, setupDefenseOwnerAndMember } from '../../support/e2e';

describe('Defense – Preferred Attacker Badge in selector', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows preferred badge when the single owner is a preferred attacker', () => {
    setupDefenseOwner('def-pref-show', 'PrefBadgePlyr', 'PrefAll', 'PB').then(
      ({ adminData, ownerData, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3', {
            is_preferred_attacker: true,
          });
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Spider-Man').find('[data-cy="preferred-badge"]').should('exist');
      },
    );
  });

  it('does not show preferred badge when the single owner is not a preferred attacker', () => {
    setupDefenseOwner('def-pref-hide', 'NoPrefBadgePlyr', 'NoPrefAll', 'NB').then(
      ({ adminData, ownerData, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3', {
            is_preferred_attacker: false,
          });
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Wolverine').find('[data-cy="preferred-badge"]').should('not.exist');
      },
    );
  });

  // Badge only shows when ALL owners are preferred attackers
  it('does not show preferred badge when only some owners are preferred attackers (multi-owner)', () => {
    setupDefenseOwnerAndMember('def-pref-multi', 'MultiPrefOwn', 'MultiPrefMem', 'MultiPrefAll', 'MP').then(
      ({ adminData, ownerData, memberData, ownerAccId, memberAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3', {
            is_preferred_attacker: true,
          });
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3', {
            is_preferred_attacker: false,
          });
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Spider-Man').find('[data-cy="preferred-badge"]').should('not.exist');
      },
    );
  });

  it('shows preferred badge when all owners are preferred attackers (multi-owner)', () => {
    setupDefenseOwnerAndMember('def-pref-all', 'AllPrefOwn', 'AllPrefMem', 'AllPrefAll', 'AP').then(
      ({ adminData, ownerData, memberData, ownerAccId, memberAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3', {
            is_preferred_attacker: true,
          });
          cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champs[0].id, '7r3', {
            is_preferred_attacker: true,
          });
        });

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Spider-Man').find('[data-cy="preferred-badge"]').should('exist');
      },
    );
  });
});
