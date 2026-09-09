import { setupWarOwner } from '../../support/e2e';

/**
 * Enemy deaths are the one figure nothing tracks, so the officer types them in
 * when ending the war. The field is optional: empty means "not recorded".
 */
describe('War – End war opponent deaths', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  /** Opens a season and creates a war under it, so the dialog asks for ELO too. */
  function setupSeasonWar(prefix: string, pseudo: string, name: string, tag: string) {
    return setupWarOwner(prefix, pseudo, name, tag).then(({ adminData, ownerData, allianceId }) => {
      return cy
        .apiCreateOpenSeason(adminData.access_token, 70)
        .then(() => cy.apiCreateWar(ownerData.access_token, allianceId, `${tag}Enemy`))
        .then(() => cy.wrap({ ownerData, allianceId }));
    });
  }

  function openEndWarDialog(userId: string) {
    cy.apiLogin(userId, 'war');
    cy.getByCy('end-war-btn').click();
    cy.getByCy('end-war-dialog').should('be.visible');
  }

  it('rejects a negative amount and blocks the confirm', () => {
    setupSeasonWar('opd-neg', 'OpdNeg', 'OpdNegAlliance', 'ON').then(({ ownerData }) => {
      openEndWarDialog(ownerData.user_id);

      cy.getByCy('end-war-elo-input').type('30');
      cy.getByCy('end-war-opponent-deaths-input').type('-5');

      cy.getByCy('end-war-opponent-deaths-error').should('be.visible');
      cy.getByCy('end-war-confirm-input').type('confirm');
      cy.getByCy('confirmation-dialog-confirm').should('be.disabled');
    });
  });

  it('accepts zero, an opponent that lost nobody', () => {
    setupSeasonWar('opd-zero', 'OpdZero', 'OpdZeroAlliance', 'OZ').then(({ ownerData }) => {
      openEndWarDialog(ownerData.user_id);

      cy.getByCy('end-war-elo-input').type('30');
      cy.getByCy('end-war-opponent-deaths-input').type('0');

      cy.getByCy('end-war-opponent-deaths-error').should('not.exist');
      cy.getByCy('end-war-confirm-input').type('confirm');
      cy.getByCy('confirmation-dialog-confirm').should('not.be.disabled');
    });
  });

  it('stays optional: an empty field never blocks ending the war', () => {
    setupSeasonWar('opd-empty', 'OpdEmpty', 'OpdEmptyAlliance', 'OE').then(({ ownerData }) => {
      openEndWarDialog(ownerData.user_id);

      cy.getByCy('end-war-elo-input').type('30');
      cy.getByCy('end-war-opponent-deaths-error').should('not.exist');
      cy.getByCy('end-war-confirm-input').type('confirm');
      cy.getByCy('confirmation-dialog-confirm').should('not.be.disabled');
    });
  });

  it('stores what was typed and shows it in the season results', () => {
    setupSeasonWar('opd-store', 'OpdStore', 'OpdStoreAlliance', 'OS').then(({ ownerData, allianceId }) => {
      openEndWarDialog(ownerData.user_id);

      cy.getByCy('end-war-elo-input').type('30');
      cy.getByCy('end-war-opponent-deaths-input').type('35');
      cy.getByCy('end-war-confirm-input').type('confirm');
      cy.getByCy('confirmation-dialog-confirm').click();

      cy.apiRequest(ownerData.access_token, 'GET', `/statistics/season-wars/${allianceId}`).then((res) => {
        expect(res.body).to.have.length(1);
        expect(res.body[0].opponent_deaths).to.eq(35);
      });
    });
  });
});
