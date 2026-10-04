import { setupWarOwner } from '../../support/e2e';

describe('Big Thing season format — war page', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('renders a 10-node map and a Big Thing badge under an active big_thing season', () => {
    setupWarOwner('bigthing', 'BTOwner', 'BTAlliance', 'BT').then(({ adminData, ownerData, allianceId }) => {
      cy.apiRequest(adminData.access_token, 'POST', '/admin/seasons', { number: 70, format: 'big_thing' }).then(
        (res) => {
          cy.apiRequest(adminData.access_token, 'PATCH', `/admin/seasons/${res.body.id}/open`).then(() => {
            cy.apiCreateWar(ownerData.access_token, allianceId, 'BTEnemy');
            cy.apiLogin(ownerData.user_id, 'war');

            // Big Thing format badge is shown
            cy.getByCy('season-format-banner').should('be.visible').and('contain', 'Big Thing');

            // Big Thing map has exactly 10 nodes (1..10); node 11+ from the
            // regular 50-node layout must not be rendered.
            cy.getByCy('war-node-10').should('exist');
            cy.getByCy('war-node-1').should('exist');
            cy.getByCy('war-node-11').should('not.exist');
            cy.getByCy('war-node-50').should('not.exist');
          });
        },
      );
    });
  });

  it('keeps the Big Thing format for a war started during a big_thing pre-season', () => {
    setupWarOwner('bigthing-pre', 'BTPreOwner', 'BTPreAlliance', 'BP').then(({ adminData, ownerData, allianceId }) => {
      // Create a big_thing season but leave it in pre-season (upcoming) — do NOT open it.
      cy.apiRequest(adminData.access_token, 'POST', '/admin/seasons', { number: 71, format: 'big_thing' }).then(() => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'BTPreEnemy');
        cy.apiLogin(ownerData.user_id, 'war');

        // Pre-season badge (no active season) — the war earns no ELO...
        cy.getByCy('season-pre-season-badge').should('be.visible').and('contain', 'Pre-season');

        // ...but the war still runs in Big Thing format (badge + 10-node map).
        cy.getByCy('season-format-banner').should('be.visible').and('contain', 'Big Thing');
        cy.getByCy('war-node-10').should('exist');
        cy.getByCy('war-node-11').should('not.exist');
      });
    });
  });

  it('orders attacker groups by node, not by pseudo', () => {
    const adminToken = 'bt-order-admin';
    const ownerToken = 'bt-order-owner';
    const memberToken = 'bt-order-member';
    // Alphabetically AlphaMember leads; by node, ZuluOwner (node 1) must lead AlphaMember (node 3).
    cy.apiBatchSetupFull([
      {
        discord_token: adminToken,
        role: 'admin',
        champions: [
          { name: 'Iron Man', champion_class: 'Tech' },
          { name: 'Wolverine', champion_class: 'Mutant' },
          { name: 'Spider-Man', champion_class: 'Cosmic' },
          { name: 'Storm', champion_class: 'Mutant' },
        ],
      },
      {
        discord_token: ownerToken,
        game_pseudo: 'ZuluOwner',
        create_alliance: { name: 'BTOrderAlliance', tag: 'BTO' },
        battlegroup: 1,
        roster: [{ champion: 'Spider-Man', rarity: '7r3' }],
      },
      {
        discord_token: memberToken,
        game_pseudo: 'AlphaMember',
        join_alliance_token: ownerToken,
        battlegroup: 1,
        roster: [{ champion: 'Storm', rarity: '7r3' }],
      },
    ]).then(({ users, champions }) => {
      const admin = users[adminToken];
      const owner = users[ownerToken];
      const member = users[memberToken];
      const allianceId = owner.alliance_id!;
      cy.apiRequest(admin.access_token, 'POST', '/admin/seasons', { number: 72, format: 'big_thing' }).then((res) => {
        cy.apiOpenSeason(admin.access_token, res.body.id);
        cy.apiCreateWar(owner.access_token, allianceId, 'BTOrderEnemy').then((war) => {
          cy.apiPlaceWarDefender(owner.access_token, allianceId, war.id, 1, 1, champions['Iron Man'], 7, 3, 0);
          cy.apiPlaceWarDefender(owner.access_token, allianceId, war.id, 1, 3, champions['Wolverine'], 7, 3, 0);
          cy.apiAssignWarAttacker(member.access_token, allianceId, war.id, 1, 3, member.champion_user_ids['Storm']);
          cy.apiAssignWarAttacker(owner.access_token, allianceId, war.id, 1, 1, owner.champion_user_ids['Spider-Man']);
        });
      });

      cy.openWarAttackerPanel(owner.user_id);
      cy.get('[data-cy^="attacker-member-"]').should(($els) => {
        expect($els.toArray().map((el) => el.dataset.cy)).to.deep.equal([
          'attacker-member-ZuluOwner',
          'attacker-member-AlphaMember',
        ]);
      });
    });
  });
});
