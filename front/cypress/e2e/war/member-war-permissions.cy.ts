import { setupAttackerScenario } from '../../support/e2e';

describe('Member — war interactive elements', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('member can see ko-inc and ko-dec buttons', () => {
    setupAttackerScenario('mem-ko').then(({ memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiLogin(memberData.user_id);
      cy.navTo('war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('ko-inc-node-10').should('be.visible');
      cy.getByCy('ko-dec-node-10').should('be.visible');
    });
  });

  it('member can see combat complete button', () => {
    setupAttackerScenario('mem-cbt').then(({ memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiLogin(memberData.user_id);
      cy.navTo('war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('combat-complete-node-10').should('be.visible');
    });
  });

  it('member can see remove attacker button', () => {
    setupAttackerScenario('mem-rma').then(({ memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiLogin(memberData.user_id);
      cy.navTo('war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('remove-attacker-node-10').should('be.visible');
    });
  });

  it('member synergy add button is enabled', () => {
    setupAttackerScenario('mem-syn').then(({ memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiLogin(memberData.user_id);
      cy.navTo('war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('synergy-trigger-Wolverine').click();
      cy.getByCy('synergy-add-Wolverine').should('be.visible').and('not.be.disabled');
    });
  });

  it('member prefight add button is enabled', () => {
    setupAttackerScenario('mem-pf').then(({ memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      cy.apiLogin(memberData.user_id);
      cy.navTo('war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('node-actions-trigger-node-10').click();
      cy.getByCy('prefight-add-node-10').should('be.visible').and('not.be.disabled');
    });
  });
});
