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

  it('shows management tab for officer/owner', () => {
    setupWarOwner('war-basic-tabs', 'TabPlayer', 'TabAlliance', 'TA').then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo('war');
      cy.getByCy('tab-war-management').should('be.visible');
      cy.getByCy('tab-war-defenders').should('be.visible');
    });
  });

  it('shows only defenders tab for non-officer members', () => {
    setupWarOwner('war-basic-member', 'MemberPlayer', 'MemberAlliance', 'MB').then(
      ({ adminData, ownerData, allianceId }) => {
        // Create a member account
        cy.registerUser('war-basic-member-member').then((memberData) => {
          cy.apiCreateGameAccount(memberData.access_token, 'RegularMember', true).then((acc) => {
            cy.apiForceJoinAlliance(acc.id, allianceId).then(() => {
              cy.uiLogin('war-basic-member-member');
              cy.navTo('war');
              cy.getByCy('tab-war-management').should('not.exist');
              cy.getByCy('tab-war-defenders').should('be.visible');
            });
          });
        });
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

  it('shows war in selector after creation', () => {
    setupWarOwner('war-basic-sel', 'SelPlayer', 'SelAlliance', 'SL').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'Enemy Alliance').then(() => {
          cy.uiLogin(ownerData.login);
          cy.navTo('war');
          cy.getByCy('war-select').should('contain', 'Enemy Alliance');
        });
      }
    );
  });

  it('shows 50 war-map nodes after selecting a war and going to defenders tab', () => {
    setupWarOwner('war-basic-nodes', 'NodeWarPlayer', 'NodeWarAlliance', 'ND').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'NodeEnemy').then(() => {
          cy.uiLogin(ownerData.login);
          cy.navTo('war');

          // Select the war then switch to defenders tab
          cy.getByCy('war-select').click();
          cy.contains('vs NodeEnemy').click();
          cy.getByCy('tab-war-defenders').click();

          for (let i = 1; i <= 50; i++) {
            cy.getByCy(`war-node-${i}`).should('exist');
          }
        });
      }
    );
  });

  it('shows G1/G2/G3 battlegroup buttons in defenders tab', () => {
    setupWarOwner('war-basic-bg', 'BGWarPlayer', 'BGWarAlliance', 'BG').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'BGEnemy').then(() => {
          cy.uiLogin(ownerData.login);
          cy.navTo('war');

          cy.getByCy('war-select').click();
          cy.contains('vs BGEnemy').click();
          cy.getByCy('tab-war-defenders').click();

          cy.getByCy('bg-btn-1').should('be.visible');
          cy.getByCy('bg-btn-2').should('be.visible');
          cy.getByCy('bg-btn-3').should('be.visible');
        });
      }
    );
  });

  it('shows declare war button in management tab for officer', () => {
    setupWarOwner('war-basic-declare', 'DeclarePlayer', 'DeclareAlliance', 'DC').then(
      ({ ownerData }) => {
        cy.uiLogin(ownerData.login);
        cy.navTo('war');
        // Management tab is the default for officers
        cy.getByCy('declare-war-btn').should('be.visible');
      }
    );
  });

  it('hides alliance picker when user has only one alliance', () => {
    setupWarOwner('war-basic-nopick', 'NoPickPlayer', 'NoPickAlliance', 'NP').then(
      ({ ownerData }) => {
        cy.uiLogin(ownerData.login);
        cy.navTo('war');
        cy.getByCy('alliance-select').should('not.exist');
      }
    );
  });
});
