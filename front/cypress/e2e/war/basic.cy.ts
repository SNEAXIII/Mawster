import { setupUser, setupWarOwner } from '../../support/e2e';

describe('War – Basic page rendering', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('hides war nav link when user has no alliance', () => {
    setupUser('war-basic-noally-nav').then(({ login }) => {
      cy.uiLogin(login);
      cy.getByCy('nav-war').should('not.exist');
    });
  });

  it('shows no-alliance message when navigating to war page without alliance', () => {
    setupUser('war-basic-noally-token').then(({ login }) => {
      cy.uiLogin(login);
      cy.visit('/game/war');
      cy.contains('need to join an alliance').should('be.visible');
    });
  });

  it('shows declare war button for officer/owner', () => {
    setupWarOwner('war-basic-tabs', 'TabPlayer', 'TabAlliance', 'TA').then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo('war');
      cy.getByCy('declare-war-btn').should('be.visible');
    });
  });

  it('shows no declare war button for non-officer members', () => {
    setupWarOwner('war-basic-member', 'MemberPlayer', 'MemberAlliance', 'MB').then(
      ({ adminData, ownerData, allianceId }) => {
        setupUser('war-basic-member-member').then((memberData) => {
          cy.apiCreateGameAccount(memberData.access_token, 'RegularMember', true).then((acc) => {
            cy.apiForceJoinAlliance(acc.id, allianceId);
            cy.uiLogin(memberData.login);
            cy.navTo('war');
            cy.getByCy('declare-war-btn').should('not.exist');
          });
        });
      },
    );
  });

  it('shows no-war message when no wars declared', () => {
    setupWarOwner('war-basic-nowar', 'NoWarPlayer', 'NoWarAlliance', 'NW').then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo('war');
      cy.contains('No war declared').should('be.visible');
    });
  });

  it('shows war opponent after creation', () => {
    setupWarOwner('war-basic-sel', 'SelPlayer', 'SelAlliance', 'SL').then(({ ownerData, allianceId }) => {
      cy.apiCreateWar(ownerData.access_token, allianceId, 'Enemy Alliance');
      cy.uiLogin(ownerData.login);
      cy.navTo('war');
      cy.getByCy('war-opponent-name').should('contain', 'Enemy Alliance');
    });
  });

  it('shows 50 war-map nodes after selecting a war and going to defenders tab', () => {
    setupWarOwner('war-basic-nodes', 'NodeWarPlayer', 'NodeWarAlliance', 'ND').then(({ ownerData, allianceId }) => {
      cy.apiCreateWar(ownerData.access_token, allianceId, 'NodeEnemy');
      cy.uiLogin(ownerData.login);
      cy.navTo('war');

      for (let i = 1; i <= 50; i++) {
        cy.getByCy(`war-node-${i}`).should('exist');
      }
    });
  });

  it('shows G1/G2/G3 battlegroup buttons in defenders tab', () => {
    setupWarOwner('war-basic-bg', 'BGWarPlayer', 'BGWarAlliance', 'BG').then(({ ownerData, allianceId }) => {
      cy.apiCreateWar(ownerData.access_token, allianceId, 'BGEnemy');
      cy.uiLogin(ownerData.login);
      cy.navTo('war');

      cy.getByCy('bg-btn-1').should('be.visible');
      cy.getByCy('bg-btn-2').should('be.visible');
      cy.getByCy('bg-btn-3').should('be.visible');
    });
  });

  it('hides alliance picker when user has only one alliance', () => {
    setupWarOwner('war-basic-nopick', 'NoPickPlayer', 'NoPickAlliance', 'NP').then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo('war');
      cy.getByCy('alliance-select').should('not.exist');
    });
  });

  // ── Mode toggle ────────────────────────────────────────────────────────────

  it('shows mode toggle in defenders tab', () => {
    setupWarOwner('war-basic-toggle', 'TogglePlayer', 'ToggleAlliance', 'TG').then(({ ownerData, allianceId }) => {
      cy.apiCreateWar(ownerData.access_token, allianceId, 'ToggleEnemy');
      cy.uiLogin(ownerData.login);
      cy.navTo('war');

      cy.getByCy('war-mode-toggle').should('be.visible');
      cy.getByCy('war-mode-defenders').should('be.visible');
      cy.getByCy('war-mode-attackers').should('be.visible');
    });
  });

  it('defaults to defenders mode', () => {
    setupWarOwner('war-basic-toggle-default', 'ToggleDefPlayer', 'ToggleDefAlliance', 'TD').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'ToggleDefEnemy');
        cy.uiLogin(ownerData.login);
        cy.navTo('war');

        cy.getByCy('war-mode-defenders').should('have.class', 'bg-primary');
        cy.getByCy('war-mode-attackers').should('not.have.class', 'bg-primary');
      },
    );
  });

  it('switches to attackers mode on click', () => {
    setupWarOwner('war-basic-toggle-switch', 'ToggleSwPlayer', 'ToggleSwAlliance', 'TS').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'ToggleSwEnemy');
        cy.uiLogin(ownerData.login);
        cy.navTo('war');

        cy.getByCy('war-mode-attackers').click();
        cy.getByCy('war-mode-attackers').should('have.class', 'bg-primary');
        cy.getByCy('war-mode-defenders').should('not.have.class', 'bg-primary');
      },
    );
  });

  it('mode toggle is hidden for non-officer members', () => {
    setupWarOwner('war-basic-toggle-member', 'ToggleMbrOwner', 'ToggleMbrAlliance', 'TM').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'ToggleMbrEnemy');
        setupUser('war-basic-toggle-member-user').then((memberData) => {
          cy.apiCreateGameAccount(memberData.access_token, 'ToggleMember', true).then((acc) => {
            cy.apiForceJoinAlliance(acc.id, allianceId).then(() => {
              cy.uiLogin(memberData.login);
              cy.navTo('war');
              cy.getByCy('war-mode-toggle').should('not.exist');
            });
          });
        });
      },
    );
  });

  it('switches back to defenders mode from attackers', () => {
    setupWarOwner('war-basic-toggle-back', 'ToggleBackPlayer', 'ToggleBackAlliance', 'TB').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'ToggleBackEnemy');
        cy.uiLogin(ownerData.login);
        cy.navTo('war');

        cy.getByCy('war-mode-attackers').click();
        cy.getByCy('war-mode-defenders').click();
        cy.getByCy('war-mode-defenders').should('have.class', 'bg-primary');
        cy.getByCy('war-mode-attackers').should('not.have.class', 'bg-primary');
      },
    );
  });
});
