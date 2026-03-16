import { setupUser, setupWarOwner } from '../../support/e2e';

describe('War – Basic page rendering', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows no-alliance message when user has no alliances', () => {
    setupUser('war-basic-noally-token').then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo('war');
      cy.contains('need to join an alliance').should('be.visible');
    });
  });

  it('shows the war page with alliance and war selectors', () => {
    setupWarOwner('war-basic-page', 'WarPlayer', 'WarAlliance', 'WA').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'Enemy Alliance');
        cy.uiLogin(ownerData.login);
        cy.navTo('war');

        cy.contains('Alliance War').should('be.visible');
        cy.getByCy('alliance-select').should('be.visible');
        cy.getByCy('war-select').should('be.visible');
        cy.getByCy('bg-select').should('be.visible');
      }
    );
  });

  it('shows no-war message when no wars declared', () => {
    setupWarOwner('war-basic-nowar', 'NoWarPlayer', 'NoWarAlliance', 'NW').then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo('war');
      cy.contains('No war declared').should('be.visible');
    });
  });

  it('shows 50 war-map nodes after selecting a war', () => {
    setupWarOwner('war-basic-nodes', 'NodeWarPlayer', 'NodeWarAlliance', 'ND').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'NodeEnemy').then(() => {
          cy.uiLogin(ownerData.login);
          cy.navTo('war');

          for (let i = 1; i <= 50; i++) {
            cy.getByCy(`war-node-${i}`).should('exist');
          }
        });
      }
    );
  });

  it('shows battlegroup selector with 3 options', () => {
    setupWarOwner('war-basic-bg', 'BGWarPlayer', 'BGWarAlliance', 'BG').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'BGEnemy').then(() => {
          cy.uiLogin(ownerData.login);
          cy.navTo('war');

          cy.getByCy('bg-select').click();
          cy.getByCy('bg-option-1').should('exist');
          cy.getByCy('bg-option-2').should('exist');
          cy.getByCy('bg-option-3').should('exist');
        });
      }
    );
  });

  it('shows declare war button for officer/owner', () => {
    setupWarOwner('war-basic-declare', 'DeclarePlayer', 'DeclareAlliance', 'DC').then(
      ({ ownerData }) => {
        cy.uiLogin(ownerData.login);
        cy.navTo('war');
        cy.getByCy('declare-war-btn').should('be.visible');
      }
    );
  });
});
