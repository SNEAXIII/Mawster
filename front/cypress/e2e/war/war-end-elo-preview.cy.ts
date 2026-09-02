import { setupWarOwner } from '../../support/e2e';

/**
 * End-war dialog ELO preview: the officer always types a POSITIVE amount and the
 * dialog derives the sign from the win/lose toggle, showing `current -> next`.
 */
describe('War – End war ELO preview', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  /** Opens a season, sets the alliance ELO, then creates a war under that season. */
  function setupSeasonWar(prefix: string, pseudo: string, name: string, tag: string, elo: number) {
    return setupWarOwner(prefix, pseudo, name, tag).then(({ adminData, ownerData, allianceId }) => {
      return cy
        .apiCreateOpenSeason(adminData.access_token, 70)
        .then(() => cy.apiRequest(ownerData.access_token, 'PATCH', `/alliances/${allianceId}/elo`, { elo }))
        .then(() => cy.apiCreateWar(ownerData.access_token, allianceId, `${tag}Enemy`))
        .then(() => cy.wrap({ ownerData, allianceId }));
    });
  }

  it('shows current ELO alone until a valid amount is typed', () => {
    setupSeasonWar('elo-prev-idle', 'PreviewIdle', 'PreviewIdleAlliance', 'PI', 1500).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'war');
      cy.getByCy('end-war-btn').click();

      cy.getByCy('end-war-elo-preview').should('be.visible').and('contain.text', '1500');
      cy.getByCy('end-war-elo-next').should('not.exist');
    });
  });

  it('adds the typed amount on a win', () => {
    setupSeasonWar('elo-prev-win', 'PreviewWin', 'PreviewWinAlliance', 'PW', 1500).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'war');
      cy.getByCy('end-war-btn').click();

      cy.getByCy('end-war-elo-input').type('30');
      cy.getByCy('end-war-elo-next').should('have.text', '1530');
    });
  });

  it('subtracts a POSITIVE typed amount on a loss', () => {
    setupSeasonWar('elo-prev-lose', 'PreviewLose', 'PreviewLoseAlliance', 'PL', 1500).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'war');
      cy.getByCy('end-war-btn').click();

      // Toggling to "lose" clears the input, so type after switching.
      cy.getByCy('end-war-win-switch').click();
      cy.getByCy('end-war-elo-input').type('30');

      // No minus sign typed, yet the preview goes down.
      cy.getByCy('end-war-elo-next').should('have.text', '1470');
      cy.getByCy('end-war-elo-error').should('not.exist');
      cy.getByCy('confirmation-dialog-confirm').should('be.disabled');
    });
  });

  it('rejects a negative amount', () => {
    setupSeasonWar('elo-prev-neg', 'PreviewNeg', 'PreviewNegAlliance', 'PN', 1500).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'war');
      cy.getByCy('end-war-btn').click();

      cy.getByCy('end-war-elo-input').type('-30');
      cy.getByCy('end-war-elo-error').should('be.visible');
      cy.getByCy('end-war-elo-next').should('not.exist');
      cy.getByCy('end-war-confirm-input').type('confirm');
      cy.getByCy('confirmation-dialog-confirm').should('be.disabled');
    });
  });

  it('clamps the preview at the backend ceiling of 4500', () => {
    setupSeasonWar('elo-prev-cap', 'PreviewCap', 'PreviewCapAlliance', 'PC', 4400).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'war');
      cy.getByCy('end-war-btn').click();

      cy.getByCy('end-war-elo-input').type('500');
      cy.getByCy('end-war-elo-next').should('have.text', '4500');
    });
  });

  it('persists the negated amount after confirming a loss', () => {
    setupSeasonWar('elo-prev-end', 'PreviewEnd', 'PreviewEndAlliance', 'PE', 1500).then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'war');
      cy.getByCy('end-war-btn').click();

      cy.getByCy('end-war-win-switch').click();
      cy.getByCy('end-war-elo-input').type('30');
      cy.getByCy('end-war-elo-next').should('have.text', '1470');
      cy.getByCy('end-war-confirm-input').type('confirm');
      cy.getByCy('confirmation-dialog-confirm').should('not.be.disabled').click();

      // War is over, and the alliance card reflects the preview.
      cy.getByCy('declare-war-btn').should('be.visible');
      cy.navTo('alliances');
      cy.getByCy('alliance-elo').should('contain.text', '1470');
    });
  });
});
