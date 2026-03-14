import { setupUser, setupRosterUser, BACKEND } from '../../support/e2e';

describe('Roster – Basic', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Basic rendering
  // =========================================================================

  it('shows no-accounts message when user has no game accounts', () => {
    setupUser('roster-noacc-token').then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo('roster');
      cy.contains('No game accounts yet. Add one to get started!').should('be.visible');
    });
  });

  it('shows empty roster message', () => {
    setupUser('roster-empty-token').then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'EmptyRoster', true);

      cy.uiLogin(login);
      cy.navTo('roster');
      cy.contains('roster is empty').should('be.visible');
    });
  });

  it('shows account selector when user has multiple accounts', () => {
    setupUser('roster-multi-token').then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'Account1', true);
      cy.apiCreateGameAccount(access_token, 'Account2', false);

      cy.uiLogin(login);
      cy.navTo('roster');
      cy.contains('Select a game account').should('be.visible');
    });
  });

  // =========================================================================
  // Add champion
  // =========================================================================

  it('opens the Add Champion form and searches for a champion', () => {
    setupRosterUser('roster-add', 'RosterPlayer').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Science');

      cy.uiLogin(userData.login);
      cy.navTo('roster');

      cy.contains('Add / Update a Champion').click();
      cy.getByCy('champion-search').type('Spider');
      cy.contains('Spider-Man').should('be.visible');
    });
  });

  it('adds a champion to the roster', () => {
    setupRosterUser('roster-addchamp', 'WolverinePlayer').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant');

      cy.uiLogin(userData.login);
      cy.navTo('roster');

      cy.contains('Add / Update a Champion').click();
      cy.getByCy('champion-search').type('Wolverine');
      cy.getByCy('champion-result-Wolverine').click();
      cy.getByCy('rarity-6r4').click();
      cy.getByCy('champion-submit').click();

      cy.contains('Wolverine added / updated').should('be.visible');
      cy.contains('Wolverine').should('exist');
    });
  });

  // =========================================================================
  // Delete champion
  // =========================================================================

  it('deletes a champion from the roster', () => {
    setupRosterUser('roster-del', 'HulkPlayer').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'HulkDel', 'Science');

      cy.uiLogin(userData.login);
      cy.navTo('roster');

      // Add champion first
      cy.contains('Add / Update a Champion').click();
      cy.getByCy('champion-search').type('HulkDel');
      cy.getByCy('champion-result-HulkDel').click();
      cy.getByCy('rarity-6r4').click();
      cy.getByCy('champion-submit').click();
      cy.contains('HulkDel added / updated').should('be.visible');

      // Now delete
      cy.getByCy('champion-delete').first().click({ force: true });
      cy.get('[role="alertdialog"]').should('be.visible').contains('button', 'Delete').click();
      cy.contains('HulkDel removed from roster').should('be.visible');
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  it('adds a champion via API and sees it in the grid', () => {
    setupRosterUser('roster-api', 'ThorPlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Thor', 'Cosmic').then((champs) => {
        cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r3');

        cy.uiLogin(userData.login);
        cy.navTo('roster');
        cy.contains('Thor').should('be.visible');
      });
    });
  });

  it('updating a champion changes its rarity in the roster', () => {
    setupRosterUser('roster-upd', 'IronPlayer').then(({ adminData, userData, accountId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Iron Man', 'Tech').then((champs) => {
        cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '6r4');

        cy.uiLogin(userData.login);
        cy.navTo('roster');

        // Update via UI: click edit, change rarity
        cy.contains('Add / Update a Champion').click();
        cy.getByCy('champion-search').type('Iron Man');
        cy.getByCy('champion-result-Iron Man').click();
        cy.getByCy('rarity-7r2').click();
        cy.getByCy('champion-submit').click();
        cy.contains('Iron Man added / updated').should('be.visible');
      });
    });
  });

  it('empty search returns no results', () => {
    setupRosterUser('roster-nosearch', 'NoSearchPlayer').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'Medusa', 'Cosmic');

      cy.uiLogin(userData.login);
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

        cy.uiLogin(userData.login);
        cy.navTo('roster');

        // Add same champion again with higher rank (same star level = upsert)
        cy.contains('Add / Update a Champion').click();
        cy.getByCy('champion-search').type('Storm');
        cy.getByCy('champion-result-Storm').click();
        cy.getByCy('rarity-7r2').click();
        cy.getByCy('champion-submit').click();
        cy.contains('Storm added / updated').should('be.visible');

        // Should only appear once in the roster
        cy.get('[data-cy="champion-delete"]').should('have.length', 1);
      });
    });
  });

  it('signature can be set via the form', () => {
    setupRosterUser('roster-sig', 'SigPlayer').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'DoctorSig', 'Mystic');

      cy.uiLogin(userData.login);
      cy.navTo('roster');

      cy.contains('Add / Update a Champion').click();
      cy.getByCy('champion-search').type('DoctorSig');
      cy.getByCy('champion-result-DoctorSig').click();
      cy.getByCy('rarity-6r4').click();
      // Set sig to 200 via preset button
      cy.contains('button', '200').click();
      cy.getByCy('champion-submit').click();
      cy.contains('DoctorSig added / updated').scrollIntoView().should('be.visible');
      cy.contains('sig 200').scrollIntoView().should('be.visible');
    });
  });

  it('hides upgrade requests section when no requests exist', () => {
    setupUser('roster-upgrades-token').then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'UpgradeAcc', true);

      cy.uiLogin(login);
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
    setupRosterUser('roster-badrarity', 'BadRarityPlayer').then(
      ({ adminData, userData, accountId }) => {
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
      }
    );
  });
});
