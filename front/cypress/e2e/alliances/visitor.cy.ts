import { BACKEND, setupVisitorScenario } from '../../support/e2e';

describe('Visitor system', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  describe('Visitor — war page', () => {
    it('cannot see management buttons', () => {
      setupVisitorScenario('vis-war').then(({ visitorData }) => {
        cy.apiLogin(visitorData.user_id);
        cy.navTo('war');

        cy.getByCy('war-mode-toggle').should('not.exist');
        cy.getByCy('end-war-btn').should('not.exist');
        cy.getByCy('clear-war-bg-btn').should('not.exist');
      });
    });
  });

  describe('Officer — alliance page visitors section', () => {
    it('sees visitor in visitors section', () => {
      setupVisitorScenario('vis-list').then(({ ownerData, visitorAccId }) => {
        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        cy.getByCy(`visitor-row-${visitorAccId}`).should('be.visible');
      });
    });

    it('can kick visitor via confirmation dialog', () => {
      setupVisitorScenario('vis-kick').then(({ ownerData, visitorAccId }) => {
        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        cy.getByCy(`kick-visitor-${visitorAccId}`).click();
        cy.getByCy('confirmation-dialog-confirm').click();

        cy.getByCy(`visitor-row-${visitorAccId}`).should('not.exist');
      });
    });

    it('can invite visitor as member', () => {
      setupVisitorScenario('vis-promote').then(({ ownerData, visitorAccId }) => {
        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        cy.getByCy(`invite-visitor-as-member-${visitorAccId}`).click();

        // Visitor row still shows (they remain a visitor until they accept)
        cy.getByCy(`visitor-row-${visitorAccId}`).should('be.visible');
      });
    });
  });

  describe('Officer — invite visitor via toggle', () => {
    it('can send a visitor invitation via the type toggle', () => {
      cy.apiBatchSetup([
        {
          discord_token: 'vis-inv-owner',
          game_pseudo: 'visInvOwner',
          create_alliance: { name: 'visInvAlliance', tag: 'VIA' },
        },
        {
          discord_token: 'vis-inv-eligible',
          game_pseudo: 'visInvElig',
        },
      ]).then((users) => {
        const ownerData = users['vis-inv-owner'];

        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        cy.getByCy('invite-member-toggle').click();
        cy.getByCy('invite-type-visitor').click();
        cy.getByCy('invite-member-select').click();
        cy.contains('visInvElig').click();
        cy.getByCy('invite-member-submit').click();

        cy.getByCy('pending-invitation-0').should('be.visible');
      });
    });
  });

  describe('Visitor — alliance page', () => {
    it('sees visitors section but no manage buttons', () => {
      setupVisitorScenario('vis-readonly').then(({ visitorData, visitorAccId }) => {
        cy.apiLogin(visitorData.user_id);
        cy.navTo('alliances');

        // Visitor row visible
        cy.getByCy(`visitor-row-${visitorAccId}`).should('be.visible');
        // No kick/invite buttons
        cy.getByCy(`kick-visitor-${visitorAccId}`).should('not.exist');
        cy.getByCy(`invite-visitor-as-member-${visitorAccId}`).should('not.exist');
      });
    });
  });
});

// ── Shared helper: alliance + war + assigned attacker + visitor ───────────────

function setupVisitorWarScene(prefix: string) {
  const adminTok = `${prefix}-admin`;
  const ownerTok = `${prefix}-owner`;
  const visitorTok = `${prefix}-visitor`;

  return cy
    .apiBatchSetup([
      { discord_token: adminTok, role: 'admin' },
      {
        discord_token: ownerTok,
        game_pseudo: `${prefix}Own`.slice(0, 16),
        create_alliance: { name: `${prefix}Alliance`, tag: prefix.slice(0, 3).toUpperCase() },
        battlegroup: 1,
      },
      { discord_token: visitorTok, game_pseudo: `${prefix}Vis`.slice(0, 16) },
    ])
    .then((users) => {
      const adminAT = users[adminTok].access_token;
      const ownerAT = users[ownerTok].access_token;
      const visitorAT = users[visitorTok].access_token;
      const visitorUserId = users[visitorTok].user_id;
      const ownerAccId = users[ownerTok].account_id!;
      const visitorAccId = users[visitorTok].account_id!;
      const allianceId = users[ownerTok].alliance_id!;

      return cy
        .request({
          method: 'POST',
          url: `${BACKEND}/alliances/${allianceId}/invitations`,
          headers: { Authorization: `Bearer ${ownerAT}` },
          body: { game_account_id: visitorAccId, type: 'visitor' },
        })
        .then((invResp) => {
          const invId = (invResp.body as { id: string }).id;
          return cy
            .request({
              method: 'POST',
              url: `${BACKEND}/alliances/invitations/${invId}/accept`,
              headers: { Authorization: `Bearer ${visitorAT}` },
              body: {},
            })
            .then(() =>
              cy.apiLoadChampion(adminAT, 'Iron Man', 'Tech').then((champs) =>
                cy.apiAddChampionToRoster(ownerAT, ownerAccId, champs[0].id, '7r3').then((cu) =>
                  cy.apiCreateWar(ownerAT, allianceId, 'VisitorEnemy').then((war) => {
                    cy.apiPlaceWarDefender(ownerAT, allianceId, war.id, 1, 10, champs[0].id, 7, 3, 0);
                    cy.apiAssignWarAttacker(ownerAT, allianceId, war.id, 1, 10, cu.id);
                    return cy.wrap({ visitorUserId, allianceId, warId: war.id });
                  }),
                ),
              ),
            );
        });
    });
}

describe('Visitor — defense page', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('cannot place a defender (clicking node does not open selector)', () => {
    setupVisitorScenario('vis-def').then(({ visitorData }) => {
      cy.apiLogin(visitorData.user_id);
      cy.navTo('defense');
      cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
      cy.contains('Select Champion').should('not.exist');
    });
  });
});

describe('Visitor — war interactive elements', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('ko-inc and ko-dec buttons are not visible', () => {
    setupVisitorWarScene('vis-ko').then(({ visitorUserId }) => {
      cy.apiLogin(visitorUserId);
      cy.navTo('war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('ko-inc-node-10').should('not.exist');
      cy.getByCy('ko-dec-node-10').should('not.exist');
    });
  });

  it('combat complete button is not visible', () => {
    setupVisitorWarScene('vis-cbt').then(({ visitorUserId }) => {
      cy.apiLogin(visitorUserId);
      cy.navTo('war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('combat-complete-node-10').should('not.exist');
    });
  });

  it('remove attacker button is not visible', () => {
    setupVisitorWarScene('vis-rma').then(({ visitorUserId }) => {
      cy.apiLogin(visitorUserId);
      cy.navTo('war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('remove-attacker-node-10').should('not.exist');
    });
  });

  it('synergy add button is visible but disabled', () => {
    setupVisitorWarScene('vis-syn').then(({ visitorUserId }) => {
      cy.apiLogin(visitorUserId);
      cy.navTo('war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('synergy-trigger-Iron-Man').click();
      cy.getByCy('synergy-add-Iron-Man').should('be.visible').and('be.disabled');
    });
  });

  it('prefight add button is visible but disabled', () => {
    setupVisitorWarScene('vis-pf').then(({ visitorUserId }) => {
      cy.apiLogin(visitorUserId);
      cy.navTo('war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('prefight-trigger-node-10').click();
      cy.getByCy('prefight-add-node-10').should('be.visible').and('be.disabled');
    });
  });
});
