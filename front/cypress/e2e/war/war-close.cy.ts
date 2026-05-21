describe('War close', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('ending a war with attackers snapshots fight records into the knowledge base', () => {
    const adminToken = 'wc-admin';
    const ownerToken = 'wc-owner';
    const attackerToken = 'wc-attacker';

    cy.apiBatchSetup([
      { discord_token: adminToken, role: 'admin' },
      {
        discord_token: ownerToken,
        game_pseudo: 'wcOwner',
        create_alliance: { name: 'wcAlliance', tag: 'WC' },
        battlegroup: 1,
      },
      {
        discord_token: attackerToken,
        game_pseudo: 'wcAttacker',
        join_alliance_token: ownerToken,
        battlegroup: 1,
      },
    ]).then((users) => {
      const adminAT = users[adminToken].access_token;
      const ownerAT = users[ownerToken].access_token;
      const attackerAccId = users[attackerToken].account_id!;
      const allianceId = users[ownerToken].alliance_id!;
      const ownerUserId = users[ownerToken].user_id;

      cy.apiLoadChampions(adminAT, [{ name: 'Iron Man', cls: 'Tech' }]).then(() =>
        cy.apiCreateWar(ownerAT, allianceId, 'OpponentClose').then((war) => {
          cy.apiBulkFillWarAttackers(war.id, 1, attackerAccId, 3);

          cy.apiEndWar(ownerAT, allianceId, war.id, true, 10).then(() => {
            cy.apiLogin(ownerUserId);
            cy.visit('/game/knowledge-base?season_selector=all');
            cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 3);
          });
        }),
      );
    });
  });
});
