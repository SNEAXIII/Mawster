import { setupAllianceOwner } from '../support/e2e';

const SIGN_UP_CTAS = ['hero-cta-primary', 'cta-discord', 'cta-google'];

describe('Home', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows the landing with sign-up to signed-out visitors', () => {
    cy.visit('/');
    SIGN_UP_CTAS.forEach((cyId) => {
      cy.getByCy(cyId).should('be.visible').and('have.attr', 'href', '/login');
    });
    cy.getByCy('home-signed-in').should('not.exist');
  });

  it('shows the Player Dashboard to signed-in players', () => {
    cy.apiBatchSetup([{ discord_token: 'home-signed-in', game_pseudo: 'HomePlayer' }]).then((users) => {
      cy.apiLogin(users['home-signed-in'].user_id);
      cy.getByCy('home-signed-in').should('be.visible');
      cy.getByCy('dashboard-refresh').should('be.visible');
      cy.getByCy('dashboard-player-select').should('not.exist');
      cy.getByCy('import-vision-button').should('be.visible');
      SIGN_UP_CTAS.forEach((cyId) => {
        cy.getByCy(cyId).should('not.exist');
      });
    });
  });

  it('lets a Player accept a pending invitation from the dashboard', () => {
    setupAllianceOwner('home-invite', 'OwnerAcc', 'DashAlliance', 'DA').then(({ userData: owner, allianceId }) => {
      cy.apiBatchSetup([{ discord_token: 'home-invitee', game_pseudo: 'Invitee' }]).then((users) => {
        const invitee = users['home-invitee'];
        cy.apiInviteMember(owner.access_token, allianceId, invitee.account_id!);
        cy.apiLogin(invitee.user_id);
        cy.getByCy('my-invitation-DashAlliance').should('be.visible');
        cy.getByCy('accept-invitation').click();
        cy.getByCy('my-invitations-section').should('not.exist');
      });
    });
  });
});
