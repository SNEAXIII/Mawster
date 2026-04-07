import { setupUser, setupRosterUser, BACKEND } from '../../support/e2e';

describe('Roster – Basic (advanced)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('adds a champion via API and sees it in the grid', () => {
    setupRosterUser('roster-api', 'ThorPlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Thor', 'Cosmic').then((champs) => {
        cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r3');

        cy.apiLogin(userData.user_id);
        cy.navTo('roster');
        cy.contains('Thor').should('be.visible');
      });
    });
  });

  it('updating a champion changes its rarity in the roster', () => {
    setupRosterUser('roster-upd', 'IronPlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Iron Man', 'Tech').then((champs) => {
        cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '6r4');

        cy.apiLogin(userData.user_id);
        cy.navTo('roster');

        cy.contains('Add / Update a Champion').click();
        cy.getByCy('champion-search').type('Iron Man');
        cy.getByCy('champion-submit').should('not.be.disabled');
        cy.getByCy('rarity-7r2').click();
        cy.getByCy('champion-submit').click();
        cy.contains('Iron Man added / updated').should('be.visible');
      });
    });
  });

  it('empty search returns no results', () => {
    setupRosterUser('roster-nosearch', 'NoSearchPlayer').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'Medusa', 'Cosmic');

      cy.apiLogin(userData.user_id);
      cy.navTo('roster');
      cy.contains('Add / Update a Champion').click();
      cy.getByCy('champion-search').type('ZZZZZZZZZ');
      cy.contains('Medusa').should('not.exist');
    });
  });

  it('adding same champion twice updates it instead of duplicating', () => {
    setupRosterUser('roster-dup', 'StormPlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Storm', 'Mutant').then((champs) => {
        cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r1');

        cy.apiLogin(userData.user_id);
        cy.navTo('roster');

        cy.contains('Add / Update a Champion').click();
        cy.getByCy('champion-search').type('Storm');
        cy.getByCy('champion-submit').should('not.be.disabled');
        cy.getByCy('rarity-7r2').click();
        cy.getByCy('champion-submit').click();
        cy.contains('Storm added / updated').should('be.visible');

        cy.get('[data-cy="champion-delete"]').should('have.length', 1);
      });
    });
  });

  it('signature can be set via the form', () => {
    setupRosterUser('roster-sig', 'SigPlayer').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'DoctorSig', 'Mystic');

      cy.apiLogin(userData.user_id);
      cy.navTo('roster');

      cy.contains('Add / Update a Champion').click();
      cy.getByCy('champion-search').type('DoctorSig');
      cy.getByCy('champion-submit').should('not.be.disabled');
      cy.getByCy('rarity-6r4').click();
      cy.contains('button', '200').click();
      cy.getByCy('champion-submit').click();
      cy.contains('DoctorSig added / updated').scrollIntoView().should('be.visible');
      cy.contains('sig 200').scrollIntoView().should('be.visible');
    });
  });

  it('hides upgrade requests section when no requests exist', () => {
    setupUser('roster-upgrades-token').then(({ user_id, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'UpgradeAcc', true);

      cy.apiLogin(user_id);
      cy.navTo('roster');
      cy.contains('Upgrade Requests').should('not.exist');
    });
  });

  it('returns 401 when adding champion without authentication (API)', () => {
    cy.request({
      method: 'POST',
      url: `${BACKEND}/champion-users`,
      body: {
        game_account_id: '00000000-0000-0000-0000-000000000000',
        champion_id: '00000000-0000-0000-0000-000000000000',
        rarity: '6r4',
        signature: 0,
      },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });

  it('returns error when adding champion with invalid rarity (API)', () => {
    setupRosterUser('roster-badrarity', 'BadRarityPlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'BadRarity', 'Science').then((champs) => {
        cy.request({
          method: 'POST',
          url: `${BACKEND}/champion-users`,
          headers: { Authorization: `Bearer ${userData.access_token}` },
          body: {
            game_account_id: accountId,
            champion_id: champs[0].id,
            rarity: 'invalid-rarity',
            signature: 0,
          },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.be.oneOf([400, 422]);
        });
      });
    });
  });
});
