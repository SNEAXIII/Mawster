import { setupAssignedAttacker } from '../../support/e2e';

describe('Member — war interactive elements', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('member can see ko-inc and ko-dec buttons', () => {
    setupAssignedAttacker('mem-ko').then(({ memberData }) => {
      cy.openWarAttackerPanel(memberData.user_id);
      cy.getByCy('ko-inc-node-10').should('be.visible');
      cy.getByCy('ko-dec-node-10').should('be.visible');
    });
  });

  it('member can see combat complete button', () => {
    setupAssignedAttacker('mem-cbt').then(({ memberData }) => {
      cy.openWarAttackerPanel(memberData.user_id);
      cy.getByCy('combat-complete-node-10').should('be.visible');
    });
  });

  it('member can see remove attacker button', () => {
    setupAssignedAttacker('mem-rma').then(({ memberData }) => {
      cy.openWarAttackerPanel(memberData.user_id);
      cy.getByCy('remove-attacker-node-10').should('be.visible');
    });
  });

  it('member synergy add button is enabled', () => {
    setupAssignedAttacker('mem-syn').then(({ memberData }) => {
      cy.openWarAttackerPanel(memberData.user_id);
      cy.getByCy('synergy-trigger-Wolverine').click();
      cy.getByCy('synergy-add-Wolverine').should('be.visible').and('not.be.disabled');
    });
  });

  it('member prefight add button is enabled', () => {
    setupAssignedAttacker('mem-pf').then(({ memberData }) => {
      cy.openWarAttackerPanel(memberData.user_id);
      cy.getByCy('node-actions-trigger-node-10').click();
      cy.getByCy('prefight-add-node-10').should('be.visible').and('not.be.disabled');
    });
  });
});
