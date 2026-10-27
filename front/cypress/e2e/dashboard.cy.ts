import { setupActiveDefense, setupAttackerScenario } from '../support/e2e';

describe('Player Dashboard', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it("lists the Player's champions on the Active Plan", () => {
    setupActiveDefense('dash-def').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.getByCy('dashboard-defense').should('be.visible');
      [1, 2, 3, 4, 5].forEach((node) => {
        cy.getByCy(`dashboard-defense-node-${node}`).should('be.visible');
      });
    });
  });

  it('hides the defense block for a Player with nothing on defense', () => {
    setupActiveDefense('dash-nodef').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id);
      cy.getByCy('dashboard-go-defense').should('be.visible');
      cy.getByCy('dashboard-defense').should('not.exist');
    });
  });

  it('lists the open Upgrade Requests', () => {
    setupAttackerScenario('dash-upg').then(({ ownerData, memberData, championUserId }) => {
      cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, '7r4');
      cy.apiLogin(memberData.user_id);
      cy.getByCy('dashboard-upgrade-requests').should('be.visible');
      cy.getByCy('dashboard-upgrade-request').should('have.length', 1);
    });
  });

  it('hides the Upgrade Requests block once none is open', () => {
    setupAttackerScenario('dash-noupg').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id);
      cy.getByCy('dashboard-war-not-ready').should('be.visible');
      cy.getByCy('dashboard-upgrade-requests').should('not.exist');
    });
  });
});
