import { setupUser, setupAllianceOwner, setupOwnerMemberAlliance } from '../../support/e2e';

describe('Defense – Basic page rendering', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows no-alliance message when user has no alliances', () => {
    setupUser('def-basic-noally-token').then(({ user_id }) => {
      cy.apiLogin(user_id);
      cy.navTo('defense');
      cy.contains('need to join an alliance').should('be.visible');
    });
  });

  it('shows the defense page with alliance and BG selectors', () => {
    setupAllianceOwner('def-basic-page', 'BasicPlayer', 'BasicAlliance', 'BA').then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.navTo('defense');

      cy.contains('Alliance:').should('be.visible');
      cy.contains('Battlegroup:').should('be.visible');
      cy.getByCy('defense-bg-1').should('be.visible');
      cy.getByCy('defense-bg-2').should('be.visible');
      cy.getByCy('defense-bg-3').should('be.visible');
    });
  });

  it('switches between battlegroups', () => {
    setupAllianceOwner('def-basic-bg', 'BGPlayer', 'BGAlliance', 'BG').then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.navTo('defense');

      cy.getByCy('defense-bg-2').click();
      cy.getByCy('defense-bg-3').click();
      cy.getByCy('defense-bg-1').click();
      cy.getByCy('defense-bg-1').should('be.visible');
    });
  });

  it('shows the Members side panel', () => {
    setupAllianceOwner('def-basic-members', 'MembersPlayer', 'MembersAlliance', 'MP').then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.navTo('defense');
      cy.contains('Members').should('be.visible');
    });
  });

  it('shows 50 war-map nodes on the page', () => {
    setupAllianceOwner('def-basic-nodes', 'NodePlayer', 'NodeAlliance', 'ND').then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.navTo('defense');

      for (let i = 1; i <= 50; i++) {
        cy.getByCy(`war-node-${i}`).should('exist');
      }
    });
  });

  it("empty nodes show '+' placeholder", () => {
    setupAllianceOwner('def-basic-empty', 'EmptyPlyr', 'EmptyAlliance', 'EM').then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.navTo('defense');

      cy.getByCy('war-node-1').should('contain', '+');
      cy.getByCy('war-node-50').should('contain', '+');
    });
  });

  it('shows section labels (Boss, Mini Boss, Tier 2, Tier 1)', () => {
    setupAllianceOwner('def-basic-sections', 'SectionPlyr', 'SectionAlliance', 'SE').then(({ userData }) => {
      cy.apiLogin(userData.user_id);
      cy.navTo('defense');

      cy.contains('Boss').should('exist');
      cy.contains('Mini Boss').should('exist');
      cy.contains('Tier 2').should('exist');
      cy.contains('Tier 1').should('exist');
    });
  });

  it('shows 0/5 defender count when no champions placed', () => {
    setupAllianceOwner('def-basic-nocount', 'EmptyCountPlyr', 'EmptyCountAll', 'EC').then(
      ({ userData, accountId, allianceId }) => {
        cy.apiSetMemberGroup(userData.access_token, allianceId, accountId, 1);

        cy.apiLogin(userData.user_id);
        cy.navTo('defense');

        cy.getByCy('defender-count-EmptyCountPlyr').should('contain', '0/5');
      },
    );
  });

  it("shows 'No defenders placed.' when member has no placements", () => {
    setupAllianceOwner('def-basic-nodef', 'NoDefPlyr', 'NoDefAlliance', 'NF').then(
      ({ userData, accountId, allianceId }) => {
        cy.apiSetMemberGroup(userData.access_token, allianceId, accountId, 1);

        cy.apiLogin(userData.user_id);
        cy.navTo('defense');
        cy.contains('No defenders placed.').scrollIntoView().should('be.visible');
      },
    );
  });

  it('member section shows member username', () => {
    setupAllianceOwner('def-basic-user', 'UserNamePlyr', 'UserNameAll', 'UN').then(
      ({ userData, accountId, allianceId }) => {
        cy.apiSetMemberGroup(userData.access_token, allianceId, accountId, 1);

        cy.apiLogin(userData.user_id);
        cy.navTo('defense');
        cy.getByCy('member-section-UserNamePlyr').scrollIntoView().should('be.visible');
        cy.getByCy('member-section-UserNamePlyr').should('contain', 'UserNamePlyr');
      },
    );
  });

  it('two members in the same BG each have their own section', () => {
    setupOwnerMemberAlliance('def-basic-2m', 'TwoMemOwner', 'TwoMemMember', 'TwoMemAll', 'TM').then(
      ({ ownerData, allianceId, ownerAccId, memberAccId }) => {
        cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
        cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 1);

        cy.apiLogin(ownerData.user_id);
        cy.navTo('defense');

        cy.getByCy('member-section-TwoMemOwner').scrollIntoView().should('be.visible');
        cy.getByCy('member-section-TwoMemMember').scrollIntoView().should('be.visible');
      },
    );
  });
});
