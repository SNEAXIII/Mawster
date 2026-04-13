import { setupWarOwner } from '../../support/e2e';

describe('War – Bans', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('declares a war with bans via UI — bans are displayed', () => {
    setupWarOwner('war-bans-ui', 'BanOfficer', 'BanAlliance', 'BA').then(
      ({ adminData, ownerData, allianceId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) => {
          const champ = champs[0];
          cy.apiLogin(ownerData.user_id);
          cy.navTo('war');

          cy.getByCy('declare-war-btn').click();
          cy.getByCy('opponent-name-input').type('BanEnemy');

          // Search and select the champion ban
          cy.getByCy('ban-search-input').type(champ.name.substring(0, 4));
          cy.getByCy(`ban-option-${champ.id}`).click();

          // Badge should appear with champion name in title
          cy.getByCy(`ban-badge-${champ.id}`).should('have.attr', 'title', champ.name);

          cy.getByCy('create-war-confirm').click();

          // Ban badge visible in war header area
          cy.getByCy(`ban-display-${champ.id}`).should('have.attr', 'title', champ.name);
        });
      },
    );
  });

  it('war declared via API with bans shows ban badges', () => {
    setupWarOwner('war-bans-api', 'BanOfficer2', 'BanAlliance2', 'BB').then(
      ({ adminData, ownerData, allianceId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Storm', 'Mutant').then((champs) => {
          const champ = champs[0];
          cy.apiCreateWar(ownerData.access_token, allianceId, 'BanTarget', [champ.id]);
          cy.apiLogin(ownerData.user_id);
          cy.navTo('war');

          cy.getByCy(`ban-display-${champ.id}`).should('have.attr', 'title', champ.name);
        });
      },
    );
  });

  it('ban selector filters by champion alias', () => {
    setupWarOwner('war-bans-alias', 'BanAlias', 'BanAliasAlliance', 'BX').then(
      ({ adminData, ownerData }) => {
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant', {
          alias: 'wolvie;logan;claws',
        }).then((champs) => {
          const champ = champs[0];
          cy.apiLogin(ownerData.user_id);
          cy.navTo('war');

          cy.getByCy('declare-war-btn').click();
          cy.getByCy('opponent-name-input').type('AliasEnemy');

          // Search by alias segment — should surface the champion
          cy.getByCy('ban-search-input').type('wolvie');
          cy.getByCy(`ban-option-${champ.id}`).should('exist');

          // Search by second alias segment
          cy.getByCy('ban-search-input').clear().type('logan');
          cy.getByCy(`ban-option-${champ.id}`).should('exist');

          // Search by non-matching term — should not appear
          cy.getByCy('ban-search-input').clear().type('zzznomatch');
          cy.getByCy(`ban-option-${champ.id}`).should('not.exist');
        });
      },
    );
  });

  it('cannot select more than 6 bans', () => {
    setupWarOwner('war-bans-max', 'BanOfficer3', 'BanAlliance3', 'BC').then(
      ({ adminData, ownerData }) => {
        const champions = [
          { name: 'Iron Man', cls: 'Tech' },
          { name: 'Thor', cls: 'Cosmic' },
          { name: 'Spider-Man', cls: 'Science' },
          { name: 'Magneto', cls: 'Mutant' },
          { name: 'Guillotine', cls: 'Mystic' },
          { name: 'Black Widow', cls: 'Skill' },
        ];
        cy.apiLoadChampions(adminData.access_token, champions.map((c) => ({ name: c.name, cls: c.cls }))).then(
          (champMap) => {
            const ids = Object.values(champMap);
            cy.apiLogin(ownerData.user_id);
            cy.navTo('war');

            cy.getByCy('declare-war-btn').click();
            cy.getByCy('opponent-name-input').type('MaxBanEnemy');

            // Select all 6 bans
            ids.forEach((c) => {
              cy.getByCy('ban-search-input').clear().type(c.name.substring(0, 4));
              cy.getByCy(`ban-option-${c.id}`).click();
            });

            // After 6 bans, search input should be disabled
            cy.getByCy('ban-search-input').should('be.disabled');
          },
        );
      },
    );
  });
});
