import { setupUser } from '../../support/e2e';

describe('Game Accounts – role badges', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows no role badge when account has no alliance', () => {
    setupUser('rb-noalliance').then(({ user_id, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'SoloPlayer', true);
      cy.apiLogin(user_id);
      cy.navTo('profile');
      cy.getByCy('account-row-SoloPlayer').scrollIntoView().should('be.visible');
      cy.getByCy('account-role-badge-SoloPlayer').should('not.exist');
    });
  });

  it('shows owner badge for the alliance owner account', () => {
    cy.apiBatchSetup([
      {
        discord_token: 'rb-owner',
        game_pseudo: 'OwnerPlayer',
        create_alliance: { name: 'TestAlliance', tag: 'TST' },
      },
    ]).then((users) => {
      const owner = users['rb-owner'];
      cy.apiLogin(owner.user_id);
      cy.navTo('profile');
      cy.getByCy('account-role-badge-OwnerPlayer')
        .scrollIntoView()
        .should('be.visible')
        .should('have.attr', 'data-role', 'owner');
    });
  });

  it('shows member badge for a regular alliance member', () => {
    cy.apiBatchSetup([
      {
        discord_token: 'rb-owner2',
        game_pseudo: 'OwnerPlayer2',
        create_alliance: { name: 'TestAlliance2', tag: 'TS2' },
      },
      {
        discord_token: 'rb-member',
        game_pseudo: 'MemberPlayer',
        join_alliance_token: 'rb-owner2',
      },
    ]).then((users) => {
      const member = users['rb-member'];
      cy.apiLogin(member.user_id);
      cy.navTo('profile');
      cy.getByCy('account-role-badge-MemberPlayer')
        .scrollIntoView()
        .should('be.visible')
        .should('have.attr', 'data-role', 'member');
    });
  });

  it('shows officer badge after promotion', () => {
    cy.apiBatchSetup([
      {
        discord_token: 'rb-owner3',
        game_pseudo: 'OwnerPlayer3',
        create_alliance: { name: 'TestAlliance3', tag: 'TS3' },
      },
      {
        discord_token: 'rb-officer',
        game_pseudo: 'OfficerPlayer',
        join_alliance_token: 'rb-owner3',
      },
    ]).then((users) => {
      const owner = users['rb-owner3'];
      const officer = users['rb-officer'];
      cy.apiAddOfficer(owner.access_token, owner.alliance_id!, officer.account_id!);
      cy.apiLogin(officer.user_id);
      cy.navTo('profile');
      cy.getByCy('account-role-badge-OfficerPlayer')
        .scrollIntoView()
        .should('be.visible')
        .should('have.attr', 'data-role', 'officer');
    });
  });
});
