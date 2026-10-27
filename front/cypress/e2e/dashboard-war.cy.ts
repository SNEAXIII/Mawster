import { BACKEND, setupActiveDefense, setupAssignedAttacker } from '../support/e2e';

describe('Player Dashboard – war block', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('lists the fights the Player has to do', () => {
    setupAssignedAttacker('dash-fights').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id);
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('attacker-entry-node-10').should('be.visible');
    });
  });

  it('warns while the Battlegroup is not Ready', () => {
    setupAssignedAttacker('dash-notready').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id);
      cy.getByCy('dashboard-war-not-ready').should('be.visible');
      cy.getByCy('dashboard-war-ready').should('not.exist');
    });
  });

  it('shows a Ready Battlegroup', () => {
    setupAssignedAttacker('dash-ready').then(({ ownerData, memberData, allianceId, warId }) => {
      cy.request({
        method: 'PUT',
        url: `${BACKEND}/alliances/${allianceId}/wars/${warId}/bg/1/ready`,
        headers: { Authorization: `Bearer ${ownerData.access_token}` },
        body: { ready: true },
      });
      cy.apiLogin(memberData.user_id);
      cy.getByCy('dashboard-war-ready').should('be.visible');
      cy.getByCy('dashboard-war-not-ready').should('not.exist');
    });
  });

  it('hides the war block when no War is running', () => {
    setupActiveDefense('dash-nowar').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.getByCy('dashboard-go-war').should('be.visible');
      cy.getByCy('dashboard-war').should('not.exist');
    });
  });

  it('saves a KO added from the dashboard', () => {
    setupAssignedAttacker('dash-ko').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id);
      cy.intercept('PATCH', '**/node/10/ko').as('updateKo');
      cy.getByCy('ko-inc-node-10').scrollIntoView().click();
      cy.wait('@updateKo');
      cy.reload();
      cy.getByCy('ko-value-node-10').should('have.text', '1');
    });
  });
});
