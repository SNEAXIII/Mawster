import { setupDefenseOwner, setupUser } from '../../support/e2e';

describe('Defense – War controls (WarBanner)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('officer sees WarBanner with "Declare War" when no active war', () => {
    setupDefenseOwner('wc-see-banner', 'BannerOwner', 'BannerAlliance', 'BNA').then(
      ({ ownerData }) => {
        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('war-banner').should('be.visible');
        cy.getByCy('declare-war-btn').should('be.visible');
        cy.getByCy('end-war-btn').should('not.exist');
      }
    );
  });

  it('officer can declare a war via dialog and banner updates', () => {
    setupDefenseOwner('wc-declare', 'DeclareOwner', 'DeclareAlliance', 'DCL').then(
      ({ ownerData }) => {
        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('declare-war-btn').click();
        cy.getByCy('opponent-name-input').should('be.visible');
        cy.getByCy('opponent-name-input').type('TestEnemy');
        cy.getByCy('create-war-confirm').click();

        cy.getByCy('current-war-opponent').should('have.text', 'TestEnemy');
        cy.getByCy('end-war-btn').should('be.visible');
      }
    );
  });

  it('officer sees "End War" when active war exists', () => {
    setupDefenseOwner('wc-active', 'ActiveOwner', 'ActiveAlliance', 'ACT').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'EnemyAlliance').then(() => {
          cy.uiLogin(ownerData.login);
          cy.navTo('defense');

          cy.getByCy('end-war-btn').should('be.visible');
          cy.getByCy('current-war-opponent').should('have.text', 'EnemyAlliance');
          cy.getByCy('declare-war-btn').should('not.exist');
        });
      }
    );
  });

  it('officer can end a war via confirm dialog and banner resets', () => {
    setupDefenseOwner('wc-end', 'EndOwner', 'EndAlliance', 'END').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'EnemyToEnd').then(() => {
          cy.uiLogin(ownerData.login);
          cy.navTo('defense');

          cy.getByCy('end-war-btn').click();
          cy.getByCy('confirmation-dialog-confirm').click();

          cy.getByCy('declare-war-btn').should('be.visible');
          cy.getByCy('end-war-btn').should('not.exist');
        });
      }
    );
  });

  it('non-officer does not see WarBanner', () => {
    setupDefenseOwner('wc-member', 'MemberOwner', 'MemberAlliance', 'MBR').then(
      ({ allianceId }) => {
        setupUser('wc-member-user').then((memberData) => {
          cy.apiCreateGameAccount(memberData.access_token, 'MemberPlayer', true).then(
            (memberAcc) => {
              cy.apiForceJoinAlliance(memberAcc.id, allianceId);

              cy.uiLogin(memberData.login);
              cy.navTo('defense');

              cy.getByCy('war-banner').should('not.exist');
            }
          );
        });
      }
    );
  });
});
