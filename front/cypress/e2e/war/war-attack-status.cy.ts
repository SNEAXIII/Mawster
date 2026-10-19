import { setupAttackerScenario } from '../../support/e2e';

describe('War — attack status of a battlegroup', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('owner opens the attacks and a member sees them open', () => {
    setupAttackerScenario('atk-open').then(({ ownerData, memberData }) => {
      cy.openWarAttackerPanel(ownerData.user_id);
      cy.getByCy('war-attack-frame').should('have.attr', 'data-ready', 'false');

      cy.getByCy('war-attack-toggle').click();
      cy.getByCy('war-attack-frame').should('have.attr', 'data-ready', 'true');

      cy.openWarAttackerPanel(memberData.user_id);
      cy.getByCy('war-attack-frame').should('have.attr', 'data-ready', 'true');
      cy.getByCy('war-attack-status').should('be.visible');
      cy.getByCy('war-attack-toggle').should('not.exist');
    });
  });

  it('owner closes the attacks again and it survives a reload', () => {
    setupAttackerScenario('atk-close').then(({ ownerData }) => {
      cy.openWarAttackerPanel(ownerData.user_id);
      cy.getByCy('war-attack-toggle').click();
      cy.getByCy('war-attack-frame').should('have.attr', 'data-ready', 'true');

      cy.getByCy('war-attack-toggle').click();
      cy.getByCy('war-attack-frame').should('have.attr', 'data-ready', 'false');

      cy.reload();
      cy.getByCy('war-attack-frame').should('have.attr', 'data-ready', 'false');
    });
  });
});
