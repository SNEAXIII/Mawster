import { setupVisitorScenario } from '../../support/e2e';

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
